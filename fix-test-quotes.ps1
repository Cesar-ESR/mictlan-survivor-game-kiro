$path = 'c:\Users\cs616\OneDrive\Escritorio\Mictlan-El honor-del-guerrero-jaguar\mictlan-game\src\systems\__tests__\change-002-memory-narrative.test.ts'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$leftQuote = [char]0x201C
$rightQuote = [char]0x201D
$emDash = [char]0x2014
$content = $content.Replace('\u201c', $leftQuote).Replace('\u201d', $rightQuote).Replace('\u2014', $emDash)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $enc)
Write-Host "Done"
