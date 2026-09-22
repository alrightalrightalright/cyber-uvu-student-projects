# Bryan Gurr | Application security portfolio

This fork contains my **Operation Candlelight, Track B** work for CYBR-4550. The assessment hardens Birthday Memory, a React/Express/PostgreSQL application, and keeps the original evidence alongside repeatable local security tests.

**[Open the project and reproduction guide](cybr-4550/threat_actors/birthday_memory/README.md)** · **[Threat model](cybr-4550/threat_actors/birthday_memory/security/threat-model.md)** · **[Verification evidence](cybr-4550/threat_actors/birthday_memory/security/verification.md)**

The main changes introduce account login, private records, verified database TLS, limited database permissions, transactional audit events, bounded requests, and hardened containers. The tests also deliberately remove an ownership check from a temporary copy to demonstrate that the regression suite detects the problem.

Testing was confined to my local fork and synthetic records. The work supports a local demonstration; real deployment still needs operational controls described in the report. Other upstream coursework folders are retained for provenance and were not included in this assessment. AI assistance is disclosed in the report and defense notes.
