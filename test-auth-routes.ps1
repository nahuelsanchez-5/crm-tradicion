$base = "http://localhost:3000"

function Test-Route {
    param(
        [string]$Label,
        [string]$Method,
        [string]$Path,
        [string]$Body = ""
    )

    $params = @{
        Uri             = "$base$Path"
        Method          = $Method
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }

    if ($Body -ne "") {
        $params.Body        = $Body
        $params.ContentType = "application/json"
    }

    try {
        $response = Invoke-WebRequest @params
        $code = $response.StatusCode
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
    }

    Write-Host ("{0,-48} -> {1}" -f $Label, $code)
}

Write-Host ""
Write-Host "=== Test: API routes sin cookie de sesion ==="
Write-Host ""

Test-Route -Label "GET  /api/carteleria/buscar?nro=1" `
           -Method "GET" `
           -Path "/api/carteleria/buscar?nro=1"

Test-Route -Label "GET  /api/carteleria/listar" `
           -Method "GET" `
           -Path "/api/carteleria/listar"

Test-Route -Label "GET  /api/carteleria/devueltos" `
           -Method "GET" `
           -Path "/api/carteleria/devueltos"

Test-Route -Label "POST /api/carteleria/devolver" `
           -Method "POST" `
           -Path "/api/carteleria/devolver" `
           -Body '{"nro_cartel":1,"agente":"test","direccion":"test","tipo_propiedad":"Casa"}'

Test-Route -Label "POST /api/operaciones/crear" `
           -Method "POST" `
           -Path "/api/operaciones/crear" `
           -Body '{"oferta_id":"test-id","precio_acordado_usd":100}'

Test-Route -Label "POST /api/ai-assistant" `
           -Method "POST" `
           -Path "/api/ai-assistant" `
           -Body '{"messages":[{"role":"user","content":"test"}]}'

Write-Host ""
Write-Host "Esperado: todas deben mostrar -> 401"
Write-Host ""
