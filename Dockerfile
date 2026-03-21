FROM debian:bookworm-slim

ARG USERNAME=agent
ARG USER_UID=1000
ARG USER_GID=1000

# 1. Base Dependencies & Repo Keys
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo curl wget ca-certificates gnupg git procps less unzip zip jq ripgrep chromium \
    && wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor > /usr/share/keyrings/adoptium-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/adoptium-keyring.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" > /etc/apt/sources.list.d/adoptium.list \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Dev Tools (Java, Maven, Node, GH CLI)
RUN apt-get update && apt-get install -y --no-install-recommends \
    temurin-25-jdk \
    maven \
    nodejs \
    gh \
    && rm -rf /var/lib/apt/lists/*

# 3. Global NPM Tools
RUN npm install -g \
    @anthropic-ai/claude-code \
    @github/copilot \
    typescript \
    vite \
    vitest \
    eslint \
    && npm cache clean --force

# 4. User Setup
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash $USERNAME \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# 5. Environment (Dynamisches Java Home)
ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-arm64
ENV PATH="$JAVA_HOME/bin:$PATH"
ENV CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"

USER $USERNAME
WORKDIR /home/$USERNAME/workspace


# 6. Updated Version Print in .bashrc
RUN echo '\n\
if [[ $- == *i* ]]; then\n\
  echo ""\n\
  echo "  locodoko-agent dev environment"\n\
  echo "  ─────────────────────────────────────────"\n\
  printf "  %-12s %s\n" "java"     "$(java -version 2>&1 | head -1)"\n\
  printf "  %-12s %s\n" "node"     "$(node --version)"\n\
  printf "  %-12s %s\n" "tsc"      "$(tsc --version)"\n\
  printf "  %-12s %s\n" "vite"     "$(vite --version 2>&1)"\n\
  printf "  %-12s %s\n" "vitest"   "$(vitest --version 2>&1 | head -1)"\n\
  printf "  %-12s %s\n" "eslint"   "$(eslint --version)"\n\
  printf "  %-12s %s\n" "claude"   "$(claude --version 2>&1 | head -1)"\n\
  printf "  %-12s %s\n" "gh"       "$(gh --version 2>&1 | head -1)"\n\
  echo "  ─────────────────────────────────────────"\n\
  echo ""\n\
fi' >> /home/$USERNAME/.bashrc

CMD ["/bin/bash"]