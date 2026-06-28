//! Sandboxed code execution module.
//!
//! Provides isolated execution environments for user code.
//! In production, this would use namespaces, cgroups, or WASM for full isolation.

use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::timeout;

pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub execution_time_ms: u64,
}

pub struct SandboxConfig {
    pub timeout_ms: u64,
    pub max_memory_mb: u64,
    pub max_output_bytes: usize,
    pub env: HashMap<String, String>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            timeout_ms: 30000, // 30 seconds
            max_memory_mb: 256,
            max_output_bytes: 1024 * 1024, // 1MB
            env: HashMap::new(),
        }
    }
}

/// Execute code in a sandboxed environment.
pub async fn execute_code(
    language: &str,
    code: &str,
    config: SandboxConfig,
) -> Result<ExecutionResult, String> {
    let start = std::time::Instant::now();

    let (cmd, args, temp_file) = prepare_execution(language, code)?;

    let mut command = Command::new(&cmd);
    for arg in &args {
        command.arg(arg);
    }

    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_clear();

    // Set safe environment variables
    command.env("PATH", "/usr/local/bin:/usr/bin:/bin");
    command.env("HOME", "/tmp");
    command.env("LANG", "en_US.UTF-8");
    for (k, v) in &config.env {
        command.env(k, v);
    }

    let duration = Duration::from_millis(config.timeout_ms);

    let result = timeout(duration, async {
        let mut child = command.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;

        let mut stdout = String::new();
        let mut stderr = String::new();

        if let Some(mut out) = child.stdout.take() {
            let mut buf = vec![0u8; config.max_output_bytes];
            let n = out.read(&mut buf).await.unwrap_or(0);
            stdout = String::from_utf8_lossy(&buf[..n]).to_string();
        }

        if let Some(mut err) = child.stderr.take() {
            let mut buf = vec![0u8; config.max_output_bytes];
            let n = err.read(&mut buf).await.unwrap_or(0);
            stderr = String::from_utf8_lossy(&buf[..n]).to_string();
        }

        let status = child.wait().await.map_err(|e| format!("Wait failed: {}", e))?;
        let exit_code = status.code().unwrap_or(-1);

        Ok::<ExecutionResult, String>(ExecutionResult {
            stdout,
            stderr,
            exit_code,
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    })
    .await;

    // Clean up temp file
    if let Some(path) = temp_file {
        let _ = tokio::fs::remove_file(path).await;
    }

    match result {
        Ok(Ok(exec_result)) => Ok(exec_result),
        Ok(Err(e)) => Err(e),
        Err(_) => Ok(ExecutionResult {
            stdout: String::new(),
            stderr: format!("Execution timed out after {}ms", config.timeout_ms),
            exit_code: -1,
            execution_time_ms: config.timeout_ms,
        }),
    }
}

fn prepare_execution(
    language: &str,
    code: &str,
) -> Result<(String, Vec<String>, Option<String>), String> {
    match language {
        "python" | "python3" => {
            let path = format!("/tmp/astra_exec_{}.py", uuid::Uuid::new_v4());
            std::fs::write(&path, code).map_err(|e| format!("Write failed: {}", e))?;
            Ok(("python3".into(), vec![path.clone()], Some(path)))
        }
        "javascript" | "node" | "js" => {
            let path = format!("/tmp/astra_exec_{}.js", uuid::Uuid::new_v4());
            std::fs::write(&path, code).map_err(|e| format!("Write failed: {}", e))?;
            Ok(("node".into(), vec![path.clone()], Some(path)))
        }
        "bash" | "sh" => {
            let path = format!("/tmp/astra_exec_{}.sh", uuid::Uuid::new_v4());
            std::fs::write(&path, code).map_err(|e| format!("Write failed: {}", e))?;
            Ok(("bash".into(), vec![path.clone()], Some(path)))
        }
        "typescript" | "ts" => {
            let path = format!("/tmp/astra_exec_{}.ts", uuid::Uuid::new_v4());
            std::fs::write(&path, code).map_err(|e| format!("Write failed: {}", e))?;
            Ok(("npx".into(), vec!["tsx".into(), path.clone()], Some(path)))
        }
        _ => Err(format!("Unsupported language: {}", language)),
    }
}
