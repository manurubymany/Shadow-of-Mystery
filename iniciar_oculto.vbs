Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & strPath & "\iniciar_jogo.bat" & Chr(34), 0
Set WshShell = Nothing