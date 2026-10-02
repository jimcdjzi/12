param([ValidateSet('evidence','codex','deepseek')][string]$Generator = 'deepseek', [int]$Port = 8787)
$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) { $pythonPath = $bundledPython } else { $pythonPath = (Get-Command python).Source }
& $pythonPath (Join-Path $PSScriptRoot 'server.py') --port $Port --generator $Generator
