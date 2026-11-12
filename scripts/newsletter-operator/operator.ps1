param(
  [ValidateSet('setup','credential-status','status','preview','test','prepare','audit','send','report')]
  [string]$Action = 'credential-status',
  [int]$Edition,
  [string]$Date,
  [string]$Worktree,
  [string]$Approval,
  [string]$Variant = 'madrid'
)
$ErrorActionPreference = 'Stop'
$vault = Join-Path $env:USERPROFILE 'AppData\Local\EventoMotor\NewsletterOperator\credentials.json'
$names = @('NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NEWSLETTER_RESEND_API_KEY')
function Get-Plain([string]$cipher) {
  $secure = $null
  $ptr = [IntPtr]::Zero
  try {
    $secure = ConvertTo-SecureString $cipher
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } catch {
    throw 'credential_decryption_failed'
  } finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($secure) { $secure.Dispose() }
  }
}
if ($Action -eq 'setup') {
  if (Test-Path -LiteralPath $vault) { throw 'credential_store_already_exists_no_overwrite' }
  $directory = Split-Path -Parent $vault
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $directory /inheritance:r /grant:r "*$($sid):(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'credential_acl_failed' }
  $entry = [ordered]@{}
  foreach ($name in $names) {
    $secure = Read-Host "Introduce $name (oculto)" -AsSecureString
    $entry[$name] = ConvertFrom-SecureString $secure
    $secure.Dispose()
  }
  $json = $entry | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($vault, $json, [Text.UTF8Encoding]::new($false))
  Write-Output 'CREDENTIAL_STORE=CREATED_FOR_CURRENT_WINDOWS_USER'
  exit 0
}
if (-not (Test-Path -LiteralPath $vault)) {
  Write-Output 'CREDENTIAL_STORE=NOT_AVAILABLE_IN_THIS_SESSION'
  exit 2
}
$lockStream = $null
$lockPath = $null
$operationSucceeded = $false
try {
  try {
    $stored = Get-Content -LiteralPath $vault -Raw | ConvertFrom-Json
  } catch {
    throw 'credential_store_unreadable'
  }
  $requiredNames = if ($Action -eq 'test' -or $Action -eq 'send' -or $Action -eq 'credential-status') { $names }
    else { @('NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY') }
  foreach ($name in $requiredNames) {
    if (-not ($stored.PSObject.Properties.Name -contains $name)) { throw 'credential_store_incomplete' }
    $value = Get-Plain $stored.$name
    if ([string]::IsNullOrWhiteSpace($value)) { throw 'credential_store_incomplete' }
    if ($Action -ne 'credential-status') { [Environment]::SetEnvironmentVariable($name, $value, 'Process') }
    $value = $null
  }
  if ($Action -eq 'credential-status') {
    Write-Output 'CREDENTIAL_STORE=DECRYPTABLE_FOR_CURRENT_WINDOWS_USER'
    exit 0
  }
  if (-not $Edition -or -not $Date) { throw 'edition_and_date_required' }
  if ($Action -in @('test','prepare','send')) {
    if ($Date -notmatch '^20\d{2}-\d{2}-\d{2}$') { throw 'edition_date_invalid' }
    $lockName = 'agenda_motor_' + $Date.Replace('-', '_') + '.lock'
    $lockPath = Join-Path (Split-Path -Parent $vault) $lockName
    try {
      $lockStream = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch {
      throw 'newsletter_operation_lock_exists_stop_and_audit'
    }
  }
  $cli = Join-Path $PSScriptRoot 'cli.mjs'
  $arguments = @($cli, $Action, '--edition', [string]$Edition, '--date', $Date)
  if ($Worktree) { $arguments += @('--worktree', $Worktree) }
  if ($Approval) { $arguments += @('--approval', $Approval) }
  if ($Variant) { $arguments += @('--variant', $Variant) }
  & node @arguments
  if ($LASTEXITCODE -ne 0) { throw 'newsletter_operator_stopped' }
  $operationSucceeded = $true
} finally {
  try {
    if ($lockStream) {
      $lockStream.Dispose()
      if ($operationSucceeded) {
        Remove-Item -LiteralPath $lockPath
      } else {
        Write-Output 'NEWSLETTER_OPERATOR_LOCK_RETAINED=YES; AUDIT_BEFORE_MANUAL_CLEAR=REQUIRED'
      }
    }
  } finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  }
}
