use std::net::SocketAddr;
use std::pin::Pin;
use tonic::{transport::Server, Request, Response, Status};
use tokio_stream::Stream;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod sandbox;

pub mod proto {
    tonic::include_proto!("astra.core");
}

use proto::core_service_server::{CoreService, CoreServiceServer};
use proto::{
    ExecuteCodeChunk, ExecuteCodeRequest, ExecuteCodeResponse,
    FileOperationRequest, FileOperationResponse,
    HealthCheckRequest, HealthCheckResponse,
};

#[derive(Debug, Default)]
pub struct CoreServiceImpl {}

#[tonic::async_trait]
impl CoreService for CoreServiceImpl {
    type ExecuteCodeStreamStream = Pin<Box<dyn Stream<Item = Result<ExecuteCodeChunk, Status>> + Send + 'static>>;

    async fn health_check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        Ok(Response::new(HealthCheckResponse {
            status: "healthy".to_string(),
            service: "core-rust".to_string(),
        }))
    }

    async fn execute_code(
        &self,
        request: Request<ExecuteCodeRequest>,
    ) -> Result<Response<ExecuteCodeResponse>, Status> {
        let req = request.into_inner();
        info!("Execute code request: language={}", req.language);

        let config = sandbox::SandboxConfig {
            timeout_ms: if req.timeout_ms > 0 { req.timeout_ms as u64 } else { 30000 },
            env: req.env,
            ..Default::default()
        };

        match sandbox::execute_code(&req.language, &req.code, config).await {
            Ok(result) => Ok(Response::new(ExecuteCodeResponse {
                stdout: result.stdout,
                stderr: result.stderr,
                exit_code: result.exit_code,
                execution_time_ms: result.execution_time_ms as i64,
            })),
            Err(e) => Ok(Response::new(ExecuteCodeResponse {
                stdout: String::new(),
                stderr: e,
                exit_code: -1,
                execution_time_ms: 0,
            })),
        }
    }

    async fn execute_code_stream(
        &self,
        request: Request<ExecuteCodeRequest>,
    ) -> Result<Response<Self::ExecuteCodeStreamStream>, Status> {
        let req = request.into_inner();
        info!("Execute code stream: language={}", req.language);

        let config = sandbox::SandboxConfig {
            timeout_ms: if req.timeout_ms > 0 { req.timeout_ms as u64 } else { 30000 },
            env: req.env,
            ..Default::default()
        };

        let result = sandbox::execute_code(&req.language, &req.code, config).await;

        let chunks = match result {
            Ok(r) => {
                let mut v = vec![];
                if !r.stdout.is_empty() {
                    v.push(Ok(ExecuteCodeChunk {
                        output: r.stdout,
                        stream: "stdout".to_string(),
                        done: false,
                        exit_code: 0,
                    }));
                }
                if !r.stderr.is_empty() {
                    v.push(Ok(ExecuteCodeChunk {
                        output: r.stderr,
                        stream: "stderr".to_string(),
                        done: false,
                        exit_code: 0,
                    }));
                }
                v.push(Ok(ExecuteCodeChunk {
                    output: String::new(),
                    stream: "".to_string(),
                    done: true,
                    exit_code: r.exit_code,
                }));
                v
            }
            Err(e) => vec![Ok(ExecuteCodeChunk {
                output: e,
                stream: "stderr".to_string(),
                done: true,
                exit_code: -1,
            })],
        };

        let stream = tokio_stream::iter(chunks);
        Ok(Response::new(Box::pin(stream)))
    }

    async fn file_operation(
        &self,
        request: Request<FileOperationRequest>,
    ) -> Result<Response<FileOperationResponse>, Status> {
        let req = request.into_inner();
        info!("File operation: op={}", req.operation);

        match req.operation.as_str() {
            "hash" => {
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                req.data.hash(&mut hasher);
                let hash = format!("{:x}", hasher.finish());
                Ok(Response::new(FileOperationResponse {
                    success: true,
                    message: hash,
                    data: Vec::new(),
                }))
            }
            "compress" => {
                // Placeholder - would use flate2 or zstd
                Ok(Response::new(FileOperationResponse {
                    success: true,
                    message: "compressed".to_string(),
                    data: req.data, // pass-through for now
                }))
            }
            _ => Ok(Response::new(FileOperationResponse {
                success: true,
                message: format!("Operation '{}' acknowledged", req.operation),
                data: Vec::new(),
            })),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let port = std::env::var("PORT").unwrap_or_else(|_| "50052".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()?;

    info!("Core Rust service starting on {}", addr);

    let service = CoreServiceImpl::default();

    Server::builder()
        .add_service(CoreServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}
