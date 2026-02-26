ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim

# Install additional tools as root
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for development with proper home directory
RUN useradd -m -s /bin/bash nodejs

# Set working directory
WORKDIR /workspace

# Set proper permissions for npm cache
RUN mkdir -p /home/nodejs/.npm && chown -R nodejs:nodejs /home/nodejs

# Switch to non-root user
USER nodejs

CMD ["/bin/bash"]
