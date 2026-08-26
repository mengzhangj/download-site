# ============================================================
# 软件站上传工具 v1.0
# 用法（三种）：
#   1) 双击运行 → 按提示输入
#   2) powershell -File upload.ps1 -File "D:\某安装包.exe" -Name "软件名" -Desc "简介" -Category "分类" -Version "1.0"
#   3) 只放文件：powershell -File upload.ps1 -File "D:\某安装包.exe"  （其余自动补全）
# 前提：首次使用请把 GitHub 访问令牌写入 C:\Users\<你>\dsh-github-token.txt
# ============================================================
param(
    [string]$File,      # 安装包路径（必填）
    [string]$Name,      # 软件名（默认取文件名）
    [string]$Desc,      # 简介
    [string]$Category,  # 分类（默认"其他"）
    [string]$Version,   # 版本号
    [switch]$NoPush     # 只更新本地，不推送到 GitHub
)

$ErrorActionPreference = "Stop"

# ---------- 配置 ----------
$Repo   = "mengzhangj/download-site"      # GitHub 仓库
$Branch = "main"
$LocalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$UploadDir  = Join-Path $LocalRoot "uploads"
$DataFile   = Join-Path $LocalRoot "software.json"
$TokenFile  = Join-Path $env:USERPROFILE "dsh-github-token.txt"

function Read-Token {
    if (Test-Path $TokenFile) { return (Get-Content $TokenFile -Raw).Trim() }
    $t = Read-Host "首次使用：请输入 GitHub 访问令牌（粘贴后回车）"
    Set-Content -Path $TokenFile -Value $t.Trim() -Encoding UTF8
    Write-Host "令牌已保存到 $TokenFile"
    return $t.Trim()
}

# ---------- 1. 校验安装包 ----------
if (-not $File -or -not (Test-Path $File)) {
    Write-Host "❌ 请提供安装包路径（把文件拖到窗口上也可）" -ForegroundColor Red
    $File = Read-Host "安装包路径"
    if (-not (Test-Path $File)) { Write-Host "❌ 文件不存在"; exit 1 }
}
if (-not $Name) { $Name = [System.IO.Path]::GetFileNameWithoutExtension($File) }
if (-not $Category) { $Category = "其他" }
$sizeMB = [math]::Round((Get-Item $File).Length / 1MB, 1)

# 目标文件名（清理特殊字符）
$cleanName = [System.IO.Path]::GetFileName($File)
$targetRel = "uploads/$cleanName"

# ---------- 2. 复制到本地 uploads ----------
New-Item -ItemType Directory -Force -Path $UploadDir | Out-Null
Copy-Item $File (Join-Path $UploadDir $cleanName) -Force
Write-Host "✅ 已复制: uploads\$cleanName ($sizeMB MB)"

# ---------- 3. 更新 software.json ----------
$data = Get-Content $DataFile -Raw -Encoding UTF8 | ConvertFrom-Json
$existing = $data.software | Where-Object { $_.file -eq $targetRel }
$entry = [ordered]@{
    id = ([System.IO.Path]::GetFileNameWithoutExtension($cleanName) -replace '[^a-zA-Z0-9]','').ToLower()
    name = $Name
    desc = $Desc
    icon = "📦"
    version = $Version
    size = "$sizeMB MB"
    os = "Windows"
    file = $targetRel
    category = $Category
    tags = @()
    note = ""
}
if ($existing) {
    # 更新已有项
    $idx = [array]::IndexOf($data.software, $existing)
    $data.software[$idx] = $entry
    Write-Host "🔄 已更新软件: $Name"
} else {
    $data.software += $entry
    Write-Host "➕ 已添加软件: $Name"
}
$data | ConvertTo-Json -Depth 5 | Set-Content $DataFile -Encoding UTF8
Write-Host "✅ software.json 已更新"

# ---------- 4. 推送 GitHub ----------
if ($NoPush) { Write-Host "（NoPush 模式，未推送）"; exit 0 }

$token = Read-Token
$api = "https://api.github.com/repos/$Repo/contents"

function Push-File([string]$localPath, [string]$repoPath, [string]$commitMsg) {
    $bytes = [System.IO.File]::ReadAllBytes($localPath)
    $b64 = [Convert]::ToBase64String($bytes)
    $body = @{ message = $commitMsg; content = $b64; branch = $Branch } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$api/$repoPath" -Method Put -Headers @{ Authorization = "token $token" } -ContentType "application/json" -Body $body -TimeoutSec 120 | Out-Null
        Write-Host "✅ 已上传: $repoPath"
    } catch {
        $resp = $_.Exception.Message
        if ($resp -match "sha") {
            # 文件已存在，需先拿 sha 再覆盖
            $sha = (Invoke-RestMethod -Uri "$api/$repoPath" -Headers @{ Authorization = "token $token" }).sha
            $body = @{ message = $commitMsg; content = $b64; branch = $Branch; sha = $sha } | ConvertTo-Json
            Invoke-RestMethod -Uri "$api/$repoPath" -Method Put -Headers @{ Authorization = "token $token" } -ContentType "application/json" -Body $body -TimeoutSec 120 | Out-Null
            Write-Host "✅ 已覆盖: $repoPath"
        } else { throw }
    }
}

Push-File (Join-Path $UploadDir $cleanName) $targetRel "上传 $Name"
Push-File $DataFile "software.json" "更新软件列表"

Write-Host ""
Write-Host "🎉 完成！刷新网站即可看到新软件：$Name"
Write-Host "   网站地址: https://mengzhangj.github.io/$($Repo.Split('/')[1])/"
