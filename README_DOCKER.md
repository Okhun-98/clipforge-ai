# Running ClipForge AI with Docker

This project includes a Dockerfile that builds the client and server and runs the server in production mode.

Build and run using Docker Compose:

```bash
# Build the docker image and start the container
docker compose up --build -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

After the container starts, the app is available at `http://localhost:3000/`.

If you don't have Docker installed, install Docker Desktop for macOS from https://www.docker.com/get-started.
