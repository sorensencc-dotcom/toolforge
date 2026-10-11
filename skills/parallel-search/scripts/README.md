# Local Test Launcher

assert-test-count.mjs runs only installed tsx/cli through process.execPath and argument arrays with shell:false. It never invokes npx or downloads missing dependencies. Default suite excludes live smoke tests and still requires at least35 native tests. Missing runtime, missing tests, spawn error, signal, and abnormal native status fail closed.

Import-line SEC-AUDITOR exception documents this intentional local subprocess boundary, not general command permission. Filenames are literal arguments, never shell text. Installed dependency ownership remains trusted. Regression tests execute a copied launcher against disposable local fake CLI modules, including shell-like filenames, missing runtime, count underflow, native failure and signal. npm test runs launcher regressions before original non-live suite; test:launcher runs regressions alone.
