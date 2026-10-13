{
  "source": "mobile-grok",
  "skill": "drive-it",
  "topic": "cic",
  "title": "Under-Sourced Assertions Brief",
  "created": "2026-10-11T15:17:57Z",
  "folder_id": "1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g",
  "status": "drop",
  "context": {
    "body": "# Under-Sourced Assertions Brief\n\n## Context\nTRM gap processor output on five under-sourced CIC assertions involving CESOR, Clara/Eleanor Ford power dynamics post-Edsel death (1943), Willow Run sketch, and assembly-line origins. Tags: VERIFIED / INFERRED / UNKNOWN. Prepared for Desktop catalog_ingest.\n\n## Payload\n### Claims table\n| # | Claim | Tag | Evidence | Citation |\n|---|-------|-----|----------|----------|\n| 1 | After Edsel’s death (May 1943), Clara Ford demanded Sorensen’s removal to clear the path for Henry Ford II. | INFERRED | Sorensen himself concluded Clara made the decision forcing his exit (formalized March 1944). Ernest Kanzler stated Clara’s hostility to Sorensen and Bennett became implacable post-Edsel. Clara began acting decisively in Henry’s name. The stronger Class B stock/family-break threat (Eleanor: “If this is not done, I shall sell my stock!”) is tied to the September 1945 HF II presidency / Bennett ouster, not specifically the 1943–44 Sorensen ouster. | American Heritage, “Power Is The Prize” (Dec 1962); NYT Sorensen obituary (14 Aug 1968); project memory (Eleanor + Clara Class B stock threat VERIFIED for 1945). |\n| 2 | Sorensen attempted to install John Gillespie as an executive counterweight to Harry Bennett’s ~3,000-man Service Department. | UNKNOWN | No primary or secondary sources located matching “John Gillespie” (or close variants) as a Ford executive counter to Bennett or Service Department in the relevant period. Searches returned only modern dealerships and unrelated individuals. | Multiple web searches (no hits in memoirs, American Heritage, or standard Ford histories). |\n| 3 | Reverend Samuel Marquis confronted Henry Ford in an explosive direct showdown over psychological torment of Edsel. | UNKNOWN | Marquis (Sociological/Welfare Department head ~1915–1921) published a critical 1923 book *Henry Ford: An Interpretation* that Ford’s organization suppressed. General accounts of Henry’s mistreatment of Edsel exist from multiple secondary sources, but no specific Marquis–Henry “showdown” over Edsel is located in available records. Marquis left Ford in 1921. | Marquis book (1923); PBS American Experience transcript and other secondary accounts of Edsel mistreatment (no Marquis confrontation detail). |\n| 4 | Sorensen single-handedly roughed out the complete mile-long Willow Run pencil floor plan on note paper in a single night. | VERIFIED | Direct from Sorensen’s memoir: after January 1941 Consolidated visit, sequestered in Coronado Hotel room; by ~4 a.m. sequenced units, timed operations, and sketched floor plan (mile long × quarter-mile wide) on hotel notepaper. Sketch later initialed by Edsel Ford and others. Widely reported in secondary sources as the origin of the Willow Run layout (final Kahn design was L-shaped due to site constraints). | Sorensen, *My Forty Years with Ford* (1956); Ann Arbor District Library account; Strategos/Willow Run secondary summary with memoir quotes. |\n| 5 | Henry Ford’s 1922 memoir and Sorensen’s 1956 memoir frame the moving assembly line as top-down (Chicago meatpacking inspiration or collective executive milestone), challenged by worker/engineer accounts. | VERIFIED (meatpacking link); INFERRED (challenge to pure top-down) | Ford’s *My Life and Work* explicitly credits Chicago packers’ overhead trolley as model for flow production. Sorensen’s memoir states Henry was sponsor, not originator; the line was conceived earlier (Piquette, Model N) via continuous experimentation by the organization. Historians emphasize collective engineers and incremental testing. | Ford memoir; Sorensen memoir; Assembly Magazine / Car and Driver / other standard histories of Highland Park 1913. |\n\n### Sources\n- American Heritage, “Power Is The Prize” (December 1962)\n- Charles E. Sorensen with Samuel T. Williamson, *My Forty Years with Ford* (1956)\n- NYT, Sorensen obituary (14 Aug 1968)\n- Ann Arbor District Library / Pulp Willow Run accounts\n- Standard assembly-line histories\n- Marquis, *Henry Ford: An Interpretation* (1923)\n- Project memory lock on Eleanor + Clara 1945 Class B stock threat\n\n### Next Actions\n- Claim 1: Cross-check Sorensen memoir and Nevins/Hill for exact Clara wording on 1944 exit. BFRC Acc. 38 / board minutes already flagged.\n- Claim 2: Targeted search in Nevins/Hill, Bennett memoir, or BFRC oral histories / Service Department files. Absent → treat as narrative invention.\n- Claim 3: Review Marquis 1923 book (Edsel/family chapters) and BFRC Marquis papers (Acc. 63 / 293).\n- Claim 4: Locate original Coronado Hotel notepaper sketch (initialed by Edsel). THF / BFRC / Acc. 38 logical.\n- Claim 5: Well-sourced; optional Highland Park process sheets only if treatment requires granular credit.\n\n## Next\nDesktop catalog_ingest / morning pipeline picks this up.",
    "raw_input": "Under-Sourced Assertions Brief",
    "provider": "deterministic_fallback"
  },
  "intent": "under_sourced_assertions_brief",
  "id": "act-1791733022845",
  "action_id": "act-1791733022845",
  "category": "RESEARCH",
  "domain": "cic",
  "target": "cic",
  "action_type": "antigravity_triage",
  "priority": "P2",
  "execution_plan": [
    {
      "step": 1,
      "handler": "antigravity",
      "action": "create_issue_and_stage"
    }
  ],
  "target_notebook_name": "CIC Research Backlog",
  "issue_url": null
}