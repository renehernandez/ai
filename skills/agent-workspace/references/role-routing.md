# Role routing

| Role | Reports to | Scope |
| --- | --- | --- |
| Delivery Executive Assistant | Rene | Global software delivery portfolio |
| Executive Operations Assistant | Rene | Calendar, email, Slack, and follow-up commitments |
| Linear Project Manager | Delivery Executive Assistant | One Linear Project |
| GitLab Project Manager | Delivery Executive Assistant | One GitLab Project long-term |
| Squad Lead | Linear Project Manager | One delivery scope within a Linear Project |

Linear Project Managers own outcome, scope, milestones, squads, and the
cross-repository dependency DAG. GitLab Project Managers own repository policy,
coherence, and live provider context. Squad Leads own implementation approach,
per-repository Git order, Runs, review, and technically ready draft delivery.

Use the role's manifest profile key. Permanent roles may escalate automatically
only through xhigh. Max and Ultra require Rene's explicit assignment. Reset the
route for every Agent Run.
