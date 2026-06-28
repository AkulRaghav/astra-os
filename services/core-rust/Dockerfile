FROM rust:1.76-slim AS builder

WORKDIR /app

# Install protobuf compiler
RUN apt-get update && apt-get install -y protobuf-compiler && rm -rf /var/lib/apt/lists/*

# Copy proto files (needed for build)
COPY proto/ /app/proto/

# Copy manifest
COPY services/core-rust/Cargo.toml services/core-rust/Cargo.lock* ./

# Create dummy source for dependency caching
RUN mkdir src && echo "fn main() {}" > src/main.rs
COPY services/core-rust/build.rs ./
RUN cargo build --release || true

# Copy actual source
COPY services/core-rust/src ./src
RUN touch src/main.rs && cargo build --release

# Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/astra-core /usr/local/bin/astra-core

EXPOSE 50052

ENTRYPOINT ["astra-core"]
