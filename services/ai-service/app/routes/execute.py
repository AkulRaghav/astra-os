"""Real code execution endpoint — runs Python and Node.js locally, AI for others."""

import asyncio
import tempfile
import os
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ExecuteRequest(BaseModel):
    code: str
    language: str


class ExecuteResponse(BaseModel):
    output: str
    error: str
    success: bool


@router.post("/run", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """Execute code. Python/Node run locally. Others use AI simulation."""
    lang = request.language.lower()

    if lang in ("python", "py"):
        return await _run_local("python", request.code, ".py")
    elif lang in ("javascript", "js", "node"):
        return await _run_local("node", request.code, ".js")
    elif lang in ("bash", "sh"):
        return await _run_local("bash", request.code, ".sh")
    else:
        # For Java, C, C++, Go, Rust — use AI simulation
        return await _run_ai(request.language, request.code)


async def _run_local(cmd: str, code: str, ext: str) -> ExecuteResponse:
    """Run code locally using the system interpreter."""
    try:
        # Write code to temp file
        with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False, encoding="utf-8") as f:
            f.write(code)
            filepath = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                cmd, filepath,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)

            output = stdout.decode("utf-8", errors="replace") if stdout else ""
            error = stderr.decode("utf-8", errors="replace") if stderr else ""

            return ExecuteResponse(
                output=output,
                error=error,
                success=proc.returncode == 0,
            )
        finally:
            os.unlink(filepath)

    except asyncio.TimeoutError:
        return ExecuteResponse(output="", error="Execution timed out (10s limit)", success=False)
    except FileNotFoundError:
        return ExecuteResponse(output="", error=f"'{cmd}' not found on system", success=False)
    except Exception as e:
        return ExecuteResponse(output="", error=str(e), success=False)


async def _run_ai(language: str, code: str) -> ExecuteResponse:
    """Use AI to simulate execution for languages not available locally."""
    from app.llm import get_completion

    messages = [
        {"role": "system", "content": "You are a code execution engine. Execute the given code and return ONLY the exact program output. No explanations, no markdown. If there's a compile/runtime error, show the error message exactly as a compiler would."},
        {"role": "user", "content": f"Execute this {language} code:\n\n{code}"},
    ]

    result = await get_completion(messages, temperature=0.0)

    # Detect if it looks like an error
    is_error = any(x in result.lower() for x in ["error", "exception", "cannot", "undefined", "traceback"])

    return ExecuteResponse(
        output="" if is_error else result,
        error=result if is_error else "",
        success=not is_error,
    )
