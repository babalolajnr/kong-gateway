import Fastify from 'fastify';
import { Pool } from 'pg';
import amqp from 'amqplib';

// Initialize Fastify server
const fastify = Fastify({
  logger: true // Enable logging for debugging
});

// Environment variables configuration
// Uses defaults if not provided, for easier local testing
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/userdb';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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

// Endpoint: List all users
// Handles GET requests to /users
fastify.get('/users', async (request, reply) => {
  try {
    // Fetch all users ordered by creation (newest last)
    const result = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id DESC');
    return result.rows;
  } catch (err: any) {
    fastify.log.error(err, 'Error fetching users');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint: Create a user
// Handles POST requests to /users
fastify.post('/users', async (request, reply) => {
  // Extract name and email from the request body
  const { name, email } = request.body as { name: string; email: string };
  
  // Basic validation
  if (!name || !email) {
    return reply.status(400).send({ error: 'Name and email are required' });
  }

  try {
    // Insert new user into the database and return the created record
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name, email]
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
