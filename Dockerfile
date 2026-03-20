FROM debian:bookworm-slim

ARG USERNAME=agent
ARG USER_UID=1000
ARG USER_GID=1000

# Install base dependencies and tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    sudo curl wget ca-certificates gnupg \
    # Version control
    git \
    # Chromium for headless browser testing (proper .deb, not Snap)
    chromium \
    # Useful extras for an agent environment
    procps less unzip zip jq \
    # Code search (used by coding agents for codebase navigation)
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Install Eclipse Temurin JDK 21 from Adoptium (official ARM64 support).
# This is more reliable than Debian packages for Java 21 on aarch64.
RUN wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public \
      | gpg --dearmor \
      | tee /usr/share/keyrings/adoptium-keyring.gpg > /dev/null \
  && echo "deb [signed-by=/usr/share/keyrings/adoptium-keyring.gpg] \
      https://packages.adoptium.net/artifactory/deb bookworm main" \
      | tee /etc/apt/sources.list.d/adoptium.list > /dev/null \
  && apt-get update \
  && apt-get install -y --no-install-recommends temurin-21-jdk \
  && rm -rf /var/lib/apt/lists/*

# Install Maven (needs Java already present)
RUN apt-get update && apt-get install -y --no-install-recommends maven \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
      https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub Copilot CLI (standalone agent for Ralph loop)
RUN npm install -g @github/copilot

# Create non-root user with passwordless sudo
RUN groupadd --gid $USER_GID $USERNAME \
  && useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash $USERNAME \
  && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
  && chmod 0440 /etc/sudoers.d/$USERNAME

# Set JAVA_HOME to Temurin 21 (aarch64 path on Apple Silicon / ARM64)
ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-arm64
ENV PATH="$JAVA_HOME/bin:$PATH"

# Point Chromium to skip the sandbox when running as non-root inside Docker.
# --no-sandbox is required because the container lacks the kernel namespace
# capabilities that Chrome's sandbox needs.
ENV CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"

USER $USERNAME
WORKDIR /home/$USERNAME/workspace

# Install GitHub Copilot CLI extension.
# NOTE: This step requires a valid GH_TOKEN or prior `gh auth login`.
# Run `docker compose exec agent gh auth login` on first startup,
# then `gh extension install github/gh-copilot` manually,
# or provide GH_TOKEN via docker-compose environment and run the
# post-start script below.
COPY --chown=$USERNAME:$USERNAME scripts/post-start.sh /home/$USERNAME/.post-start.sh
RUN chmod +x /home/$USERNAME/.post-start.sh

# Print tool versions on every interactive bash session start
RUN echo '\n\
# Show tool versions on shell login\n\
if [[ $- == *i* ]]; then\n\
  echo ""\n\
  echo "  locodoko-agent dev environment"\n\
  echo "  ─────────────────────────────────────────"\n\
  printf "  %-12s %s\n" "java"     "$(java -version 2>&1 | head -1)"\n\
  printf "  %-12s %s\n" "maven"    "$(mvn -version 2>&1 | head -1 | cut -d" " -f1-3)"\n\
  printf "  %-12s %s\n" "node"     "$(node --version)"\n\
  printf "  %-12s %s\n" "npm"      "$(npm --version)"\n\
  printf "  %-12s %s\n" "git"      "$(git --version)"\n\
  printf "  %-12s %s\n" "gh"       "$(gh --version 2>&1 | head -1)"\n\
  printf "  %-12s %s\n" "copilot"  "$(copilot --version 2>/dev/null || echo not found)"\n\
  printf "  %-12s %s\n" "rg"       "$(rg --version 2>/dev/null | head -1)"\n\
  printf "  %-12s %s\n" "chromium" "$(chromium --version 2>/dev/null | head -1)"\n\
  echo "  ─────────────────────────────────────────"\n\
  echo ""\n\
fi' >> /home/$USERNAME/.bashrc

CMD ["/bin/bash"]
