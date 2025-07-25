# Multi-stage build for production-ready container
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./
COPY src/ ./src/
COPY frameworks/ ./frameworks/

# Install dependencies with uv
RUN uv pip install --system --no-cache -e .

# Production stage
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv in production image
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:${PATH}"

# Create non-root user
RUN useradd -m -u 1000 augments

# Set working directory
WORKDIR /app

# Copy from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

# Copy configuration files
COPY frameworks/ ./frameworks/

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && chown -R augments:augments /app

# Copy uv to augments user
RUN cp -r /root/.cargo /home/augments/.cargo && \
    chown -R augments:augments /home/augments/.cargo

# Switch to non-root user
USER augments
ENV PATH="/home/augments/.cargo/bin:${PATH}"

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV ENV=production
ENV AUGMENTS_CACHE_DIR=/app/cache

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Expose port (Railway sets PORT env var)
EXPOSE ${PORT:-8080}

# Run the web server with uv
CMD ["uv", "run", "python", "-m", "augments_mcp.web_server"]