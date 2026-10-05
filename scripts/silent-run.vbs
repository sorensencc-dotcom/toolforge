' Universal silent runner for background commands on Windows
' Usage: wscript.exe //B //Nologo "C:\dev\scripts\silent-run.vbs" "<command-with-args>"
If WScript.Arguments.Count = 0 Then
    WScript.Quit 1
End If

Dim command, i, arg
If WScript.Arguments.Count = 1 Then
    command = WScript.Arguments(0)
Else
    command = ""
    For i = 0 To WScript.Arguments.Count - 1
        arg = WScript.Arguments(i)
        If InStr(arg, " ") > 0 And Left(arg, 1) <> """" Then
            arg = """" & arg & """"
        End If
        If i = 0 Then
            command = arg
        Else
            command = command & " " & arg
        End If
    Next
End If

Dim objShell
Set objShell = CreateObject("WScript.Shell")
' 0 = Hide window (SW_HIDE), False = Return immediately without blocking/waiting
objShell.Run command, 0, False
Set objShell = Nothing
