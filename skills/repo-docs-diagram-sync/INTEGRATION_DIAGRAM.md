# Integration diagram

```
+-------------------------------------------------------------+
|                     Markdown Documents                      |
|                  (README.md, Specs, Wiki)                   |
+------------------------------+------------------------------+
                               |
                   node scripts/diagram-sync.mjs
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
        +-----------+                     +------------+
        |  Mermaid  |                     |  Headless  |
        |  Scanner  |                     |   Chrome   |
        +-----+-----+                     +-----+------+
              |                                 |
              v                                 v
     +-----------------+               +------------------+
     | HTML+SVG Specs  | ------------> | PNG Diagram Asset|
     | (Cathryn Lavery)|               | (Embedded in MD) |
     +-----------------+               +------------------+

                               |
                 node scripts/docs-synthesizer.mjs
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
        +-----------+                     +------------+
        | Writing   |                     | Wiki Stage |
        | Heuristics|                     | & Mirror   |
        +-----------+                     +------------+
```
