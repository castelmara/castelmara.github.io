$ErrorActionPreference = "Stop"

$profilesPath = "data/ankety-profiles.js"
$directoryPath = "data/character-directory.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-QuestionnaireParagraphs([string]$path) {
  $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $path))
  try {
    $entry = $archive.GetEntry('word/document.xml')
    if (-not $entry) { throw "word/document.xml not found in $path" }
    $stream = $entry.Open()
    try {
      $reader = [IO.StreamReader]::new($stream)
      try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $stream.Dispose() }
  } finally { $archive.Dispose() }

  $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $result = @()
  foreach ($paragraph in $xml.SelectNodes('//w:body/w:p', $ns)) {
    $text = (($paragraph.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '').Trim()
    if ($text) { $result += $text }
  }
  return $result
}

function Find-Paragraph([string[]]$paragraphs, [string]$pattern, [int]$start = 0) {
  for ($i = $start; $i -lt $paragraphs.Count; $i++) {
    if ($paragraphs[$i] -match $pattern) { return $i }
  }
  throw "Paragraph matching '$pattern' was not found"
}

function Strip-Label([string]$text, [string]$pattern) {
  return ([regex]::Replace($text, $pattern, '', [Text.RegularExpressions.RegexOptions]::IgnoreCase)).Replace([char]0x3164, ' ').Trim(' ', "`t", ':', [char]0x00A0)
}

function Join-Section([string[]]$paragraphs, [int]$start, [int]$end, [string]$labelPattern) {
  $items = @()
  for ($i = $start; $i -lt $end; $i++) {
    $text = $paragraphs[$i].Replace([char]0x3164, ' ').Trim(' ', "`t", [char]0x00A0)
    if ($i -eq $start) { $text = Strip-Label $text $labelPattern }
    if ($text) { $items += $text }
  }
  return ($items -join "`n`n").Trim()
}

function Value-AfterLabel([string[]]$paragraphs, [string]$labelPattern) {
  foreach ($text in $paragraphs) {
    if ($text -match $labelPattern) {
      return (Strip-Label $text ('.*?' + $labelPattern)).Trim(' ', ';', '.')
    }
  }
  return ''
}

$specs = @(
  [pscustomobject]@{ id='gwendoline-gallagher'; file='gwendoline_grace_gallagher.docx'; type='student_academic'; fullName='Гвендолин Грейс Галлахер'; originalName='Gwendoline Grace Gallagher'; course='3 курс'; faculty='факультет спортивной аналитики, управления, права и агентской деятельности'; department='кафедра спортивного права и агентской деятельности'; specialization='капитан группы поддержки «castelmara sunbirds»'; team='castelmara sunbirds'; faceclaim='madelyn cline' },
  [pscustomobject]@{ id='marcus-perez'; file='marcus_perez.docx'; type='adult'; fullName='Маркус Перес'; originalName='Marcus Perez'; course=''; faculty='факультет индивидуальных видов спорта'; department='кафедра лёгкой атлетики'; specialization='тренер спринтерской группы; преподаватель по ОФП для кафедр футбола и баскетбола; ведёт факультатив «массаж и спортивная реабилитация»'; team=''; faceclaim='jensen ackles' },
  [pscustomobject]@{ id='elarian-casterly'; file='elarian_casterly.docx'; type='student_academic'; fullName='Элариан Кастерли'; originalName='Elarian Casterly'; course='3 курс'; faculty='факультет спортивной журналистики и медиа'; department='кафедра цифровых медиа и SMM'; specialization='группа поддержки «castelmara foxes»'; team='castelmara foxes'; faceclaim='dove cameron' },
  [pscustomobject]@{ id='rene-gott'; file='rene_gott.docx'; type='student_sport'; fullName='Рене Готт'; originalName='René Gott'; course='2 курс'; faculty='факультет тактики и игровых видов спорта'; department='кафедра хоккея'; specialization='правый крайний нападающий'; team='castelmara wolves'; faceclaim='herman tømmeraas' },
  [pscustomobject]@{ id='satoru-saitou'; file='satoru_saitou.docx'; type='student_sport'; fullName='Сатору Сайто'; originalName='Satoru Saitou'; course='2 курс'; faculty='факультет индивидуальных видов спорта'; department='кафедра зимних индивидуальных видов спорта'; specialization='одиночное фигурное катание'; team=''; faceclaim='park sunghoon' },
  [pscustomobject]@{ id='ilias-markou'; file='ilias_marku.docx'; type='student_academic'; fullName='Илиас Марку'; originalName='Ilias Markou'; course='3 курс'; faculty='факультет спортивной журналистики и медиа'; department='кафедра цифровых медиа и SMM'; specialization='контент-менеджер castelmara foxes'; team=''; faceclaim='choi soobin' },
  [pscustomobject]@{ id='axel-beltran'; file='axel_renato_beltran.docx'; type='student_sport'; fullName='Аксель Ренато Бельтран'; originalName='Axel Renato Beltrán'; course='2 курс'; faculty='факультет тактики и игровых видов спорта'; department='кафедра баскетбола'; specialization='атакующий защитник'; team='castelmara flames'; faceclaim='martin jonathan edwards' }
)

$records = @()
foreach ($spec in $specs) {
  $path = Join-Path 'source/ankety' $spec.file
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing questionnaire: $path" }
  $p = @(Get-QuestionnaireParagraphs $path)
  Write-Host "Parsing $($spec.file)"

  $bio = Find-Paragraph $p '^биография'
  $section3 = Find-Paragraph $p '^раздел\s+iii\.' ($bio + 1)
  $personality = Find-Paragraph $p '^характер' ($section3 + 1)
  $motivation = Find-Paragraph $p '^мотивация\s+и\s+амбиции' ($personality + 1)
  $section4 = Find-Paragraph $p '^раздел\s+iv\.' ($motivation + 1)
  $extra = Find-Paragraph $p '^дополнительные\s+факты' ($section4 + 1)

  $birthLine = ($p | Where-Object { $_ -match 'возраст\s+и\s+дата\s+рождения:' } | Select-Object -First 1)
  if ($birthLine -notmatch 'возраст\s+и\s+дата\s+рождения:\s*(\d{2}\.\d{2}\.\d{4})\s*[,;]\s*([^;]+?)(?:[.;]|$)') {
    throw "Could not parse birth data for $($spec.id): $birthLine"
  }
  $birthDate = $Matches[1]
  $age = $Matches[2].Trim()

  $nicknameLine = ($p | Where-Object { $_ -match 'производные\s+от\s+имени|^—\s*мар;' } | Select-Object -First 1)
  if ($nicknameLine -match 'производные\s+от\s+имени[^:]*:\s*(.*)$') { $nicknames = $Matches[1].Trim(' ', ';', '.') }
  elseif ($nicknameLine -match '^—\s*(.*?);\s*возраст') { $nicknames = $Matches[1].Trim() }
  else { $nicknames = '' }
  if (-not $nicknames) {
    $birthIndex = Find-Paragraph $p 'возраст\s+и\s+дата\s+рождения:'
    $plainNickname = @($p[0..($birthIndex - 1)] | Where-Object { $_ -match '^—\s*' } | Select-Object -Last 1)
    if ($plainNickname) { $nicknames = ($plainNickname -replace '^—\s*', '').Trim(' ', ';', '.') }
  }

  $mainInfo = [ordered]@{
    fullName = $spec.fullName
    originalName = $spec.originalName
    birthDate = $birthDate
    age = $age
    placeOfBirth = Value-AfterLabel $p 'место\s+рождения:'
  }
  if ($spec.course) { $mainInfo.course = $spec.course }
  if ($spec.faculty) { $mainInfo.faculty = $spec.faculty }
  if ($spec.department) { $mainInfo.department = $spec.department }
  if ($nicknames) { $mainInfo.nicknames = $nicknames }
  if ($spec.specialization) { $mainInfo.specialization = $spec.specialization }
  if ($spec.team) { $mainInfo.team = $spec.team }
  $social = Value-AfterLabel $p 'никнейм\s+в\s+локальном\s+приложении\s+академии\s*/\s*соцсетях:'
  if ($social) { $mainInfo.socialNickname = $social }
  $mainInfo.faceclaim = $spec.faceclaim
  $level = Value-AfterLabel $p 'уровень\s+вовлеченности\s+персонажа\s+в\s+сюжет:'
  if ($level) { $mainInfo.level = $level }

  $records += [ordered]@{
    id = $spec.id
    type = $spec.type
    fullName = $spec.fullName
    originalName = $spec.originalName
    profile = [ordered]@{
      sourceQuestionnaire = $spec.file
      overview = [ordered]@{ mainInfo = $mainInfo }
      dossier = [ordered]@{
        biography = [ordered]@{ text = Join-Section $p $bio $section3 '^биография\s*:?' }
        personality = [ordered]@{ text = Join-Section $p $personality $motivation '^характер\s*:?' }
        motivation = [ordered]@{ text = Join-Section $p $motivation $section4 '^мотивация\s+и\s+амбиции\s*:?' }
        extra = [ordered]@{ text = Join-Section $p $extra $p.Count '^дополнительные\s+факты\s*:?' }
      }
    }
  }
}

$profiles = (Get-Content -LiteralPath $profilesPath -Raw -Encoding UTF8).TrimStart([char]0xFEFF)
$directory = (Get-Content -LiteralPath $directoryPath -Raw -Encoding UTF8).TrimStart([char]0xFEFF)

foreach ($entry in $records) {
  if ($profiles.Contains('"id": "' + $entry.id + '"')) {
    throw "Profile $($entry.id) already exists; refusing to create a duplicate"
  }
}

$endPattern = '(?ms)(\r?\n\s*\];\s*\r?\n\s*const\s+characters\s*=\s*window\.ATLAS_CHARACTERS)'
$endMatch = [regex]::Match($profiles, $endPattern)
if (-not $endMatch.Success) { throw 'Could not find the end of the imported profile array' }
$jsonObjects = @($records | ForEach-Object { $_ | ConvertTo-Json -Depth 20 })
$profiles = $profiles.Insert($endMatch.Index, ",`n" + ($jsonObjects -join ",`n"))

foreach ($spec in $specs) {
  $id = [regex]::Escape($spec.id)
  $pattern = '(?s)("id"\s*:\s*"' + $id + '".*?"existing"\s*:\s*")[^"]+("\s*,)'
  $match = [regex]::Match($directory, $pattern)
  if (-not $match.Success) { throw "Directory card for $($spec.id) was not found" }
  $directory = [regex]::Replace($directory, $pattern, '${1}full$2', 1)
}

[IO.File]::WriteAllText((Resolve-Path $profilesPath), $profiles.TrimEnd("`r", "`n") + "`n", $utf8NoBom)
[IO.File]::WriteAllText((Resolve-Path $directoryPath), $directory.TrimEnd("`r", "`n") + "`n", $utf8NoBom)

Write-Host "Imported $($records.Count) questionnaires:"
$records | ForEach-Object { Write-Host "  - $($_.id)" }
