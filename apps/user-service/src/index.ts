import Fastify from 'fastify';
import { Pool } from 'pg';
import amqp from 'amqplib';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import metricsPlugin from 'fastify-metrics';

// Initialize Fastify server
const fastify = Fastify({
  logger: true // Enable logging for debugging
});

// Register Prometheus metrics
fastify.register(metricsPlugin, { endpoint: '/metrics' });

// Environment variables configuration
// Uses defaults if not provided, for easier local testing
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/userdb';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-key';

// Initialize PostgreSQL connection pool
// This manages multiple connections efficiently
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Helper function to initialize the database
async function initDb() {
  const client = await pool.connect();
  try {
    // Ensure the users table exists. This is critical for the service to start properly.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Add columns if the table already existed without them
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) DEFAULT 0.00;
    `);
    
    fastify.log.info('Users table ensured in database.');
  } catch (err: any) {
    fastify.log.error(err, 'Failed to initialize database');
    throw err;
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

// Global variable to keep the RabbitMQ channel open
let rabbitChannel: amqp.Channel;

// Helper function to initialize RabbitMQ connection
async function initRabbitMQ() {
  try {
    // Connect to the RabbitMQ server
    const connection = await amqp.connect(RABBITMQ_URL);
    // Create a channel for publishing messages
    rabbitChannel = await connection.createChannel();
    // Ensure the user_events queue exists and is durable (survives restarts)
    await rabbitChannel.assertQueue('user_events', { durable: true });
    fastify.log.info('Connected to RabbitMQ and ensured user_events queue.');
  } catch (err: any) {
    fastify.log.error(err, 'Failed to connect to RabbitMQ');
    throw err;
  }
}

// Register Swagger
fastify.register(swagger, {
  swagger: {
    info: {
      title: 'User Service API',
      description: 'API documentation for the User Service',
      version: '1.0.0'
    },
    host: 'localhost:8000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

fastify.register(swaggerUi, {
  routePrefix: '/docs/users',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
});

// Endpoint: List all users
// Handles GET requests to /users
fastify.get('/users', async (request, reply) => {
  try {
    // Fetch all users ordered by creation (newest last)
    const result = await pool.query('SELECT id, name, email, balance, created_at FROM users ORDER BY id DESC');
    return result.rows;
  } catch (err: any) {
    fastify.log.error(err, 'Error fetching users');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint: Create a user
// Handles POST requests to /users
fastify.post('/users', async (request, reply) => {
  // Extract name, email, and password from the request body
  const { name, email, password } = request.body as any;
  
  // Basic validation
  if (!name || !email || !password) {
    return reply.status(400).send({ error: 'Name, email, and password are required' });
  }

  try {
    // Hash the password before saving
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user into the database and return the created record
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password_hash]
    );
    
    const newUser = result.rows[0];

    // Publish a 'USER_CREATED' event to RabbitMQ for other services to consume
    if (rabbitChannel) {
      const event = {
        type: 'USER_CREATED',
        data: newUser
      };
      // Send the JSON stringified event as a buffer
      rabbitChannel.sendToQueue('user_events', Buffer.from(JSON.stringify(event)));
      fastify.log.info(`Published USER_CREATED event for user ${newUser.id}`);
    }

    // Return the created user with a 201 Created status
    return reply.status(201).send(newUser);
  } catch (err: any) {
    fastify.log.error(err, 'Error creating user');
    // Handle specific PostgreSQL error codes
    if (err.code === '23505') { // Postgres unique violation (e.g., email already exists)
      return reply.status(409).send({ error: 'Email already exists' });
    }
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint: Login a user
// Handles POST requests to /login
fastify.post('/login', async (request, reply) => {
  const { email, password } = request.body as any;
  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Generate JWT
    // The 'iss' must match the 'key' in kong.yml consumer credentials
    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, iss: 'kong-issuer' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return reply.send({ token });
  } catch (err: any) {
    fastify.log.error(err, 'Error during login');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint: Fund user wallet
fastify.post('/users/:id/fund', async (request, reply) => {
  const { id } = request.params as any;
  const { amount } = request.body as any;

  if (amount == null || amount <= 0) {
    return reply.status(400).send({ error: 'Invalid amount' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING id, balance',
      [amount, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ message: 'Funded successfully', user: result.rows[0] });
  } catch (err: any) {
    fastify.log.error(err, 'Error funding wallet');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint: Deduct from user wallet
fastify.post('/users/:id/deduct', async (request, reply) => {
  const { id } = request.params as any;
  const { amount } = request.body as any;

  if (amount == null || amount <= 0) {
    return reply.status(400).send({ error: 'Invalid amount' });
  }

  try {
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'User not found' });
      }

      const balance = parseFloat(userRes.rows[0].balance);
      if (balance < amount) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Insufficient funds' });
      }

      const updateRes = await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING id, balance',
        [amount, id]
      );

      await client.query('COMMIT');
      return reply.send({ message: 'Deducted successfully', user: updateRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    fastify.log.error(err, 'Error deducting wallet');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Start the Fastify server
const start = async () => {
  try {
    // Initialize external services first
    await initDb();
    await initRabbitMQ();
    
    // Listen on 0.0.0.0 so Docker can map the port to the host machine
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server is running at http://0.0.0.0:${PORT}`);
  } catch (err: any) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
