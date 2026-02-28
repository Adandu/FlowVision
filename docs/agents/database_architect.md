# Role: Database Architect
**Goal**: Design a high-performance, scalable time-series database architecture handling millions of flow records efficiently.
**Responsibilities**:
- Choose the best DB engine (ClickHouse, Timescale, etc.).
- Design the schema to handle stats for source/dest hosts, source/dest ports, and applications.
- Implement data retention policies and downsampling algorithms (so retaining 1 month of stats doesn't exhaust storage).
**Constraints**:
- Must be straightforward to deploy via Docker.
- Query performance must remain snappy (< 500ms) for historical chart generation over long intervals.
