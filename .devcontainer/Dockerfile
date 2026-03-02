FROM thomasloven/hass-custom-devcontainer:latest

# Install Node.js 24 (must run as root)
USER root
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Fix CRLF line endings in the container script (base image ships with Windows line endings)
RUN sed -i 's/\r//' /usr/bin/container

# Enable corepack (yarn)
RUN corepack enable
