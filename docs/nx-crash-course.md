# Nx Crash Course

## What is Nx?
Nx is a smart, fast, and extensible build system with first-class monorepo support and powerful integrations. It helps you manage multiple projects (apps and libraries) in a single repository.

## Key Concepts
- **Workspace**: The root directory containing `nx.json`. It defines global configuration.
- **Projects**: Applications or libraries inside your workspace. Defined by `project.json` in their respective directories.
- **Targets**: Commands you can run on a project (e.g., `build`, `serve`, `lint`, `test`).
- **Task Graph**: Nx understands the dependencies between your projects and runs tasks in the correct order, in parallel when possible.
- **Caching**: Nx caches the results of computation. If you run a command and the inputs haven't changed, Nx instantly replays the output.

## Essential Commands
- `npx nx run <project>:<target>`: Run a specific target on a specific project.
- `npx nx run-many -t <target>`: Run a target across all projects.
- `npx nx affected -t <target>`: Run a target only on projects affected by your current changes.
- `npx nx graph`: Opens a visual representation of your workspace dependencies.

## Nx in this Project
We use Nx to orchestrate building and linting across our polyglot microservices (Go, TypeScript, Rust). Each app has a `project.json` file defining tasks that wrap native build tools (`go build`, `cargo build`, `tsc`, etc.).
