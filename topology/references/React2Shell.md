Anatomy of an Attack — React2Shell
Attack Flow
Initial Scenario A customer-facing web application includes a support AI agent. An attacker submits a malicious prompt that manipulates the AI into generating a malicious serialized payload, which is processed by React Server Components and triggers remote code execution.
1. Entry — Load Balancer
Tool: Cisco Application Delivery Controller (ADC)
Receives malicious AI prompt via chat
What is happening: External user sends a malicious prompt into the application entry point.
Traffic flow: User → Load Balancer → AI Application
Logs:
Request metadata
Abnormal request patterns
Logs forwarded to Splunk
Visual notes:
Show incoming user request (highlight as malicious) 
Arrow flowing into load balancer, then to app 
Small side arrow from load balancer to Splunk (logs) 

2. AI Layer — Prompt Injection Detection
Tool: Cisco AI Defense
Detects prompt manipulation attempt
What is happening: AI identifies the prompt as suspicious but does not block it.
Traffic flow: Load Balancer → AI → Backend systems
Generates:
High-confidence alert: Prompt Injection
Alert sent to Splunk
Visual notes:
AI box with warning icon 
Arrow continues forward (no block) 
Separate alert arrow to Splunk 

3. AI → Backend Trust Boundary
AI-generated payload passed downstream
No immediate block → attack continues
What is happening: AI generates a malicious serialized payload that crosses from AI layer into backend services without validation.
Traffic flow: AI → (Trust Boundary) → Backend Application Services
Visual notes:
Clearly label “Trust Boundary” 
Highlight this crossing as a key risk point 
Arrow continues cleanly (no block or inspection) 
Label arrow: “malicious payload passed downstream” 

4. Deep Inspection — IPS
Tool: Cisco Secure IPS
Flags:
Suspicious serialized payload
What is happening: IPS inspects traffic and detects suspicious payload characteristics but does not fully stop execution.
Traffic flow: Backend Services → IPS → Application Server
Generates:
Medium/high severity alert
Sent to Splunk
Visual notes:
IPS inline with traffic path 
Warning indicator (not blocking) 
Arrow continues forward 
Alert arrow to Splunk 




5. Smart Switch
Tool: Cisco Nexus 9000 Series Switches
Detects unusual service-to-service traffic
What is happening: Internal network communication shows abnormal patterns as the attack moves laterally toward the target server.
Traffic flow: Backend Service → Backend Service → Application Server
Exports:
NetFlow / telemetry
Sent to Splunk
Visual notes:
Multiple internal service nodes 
Highlight one abnormal path (different color or dashed line) 
Telemetry arrow to Splunk 

6. Exploitation — Application Server
RCE triggered via React SSR
No direct visibility yet.
What is happening: The malicious payload is executed on the application server, resulting in remote code execution.
Traffic flow: Payload reaches Application Server → Code execution triggered
Visual notes:
Highlight server as “compromised” 
Add visual cue (glow, alert symbol, or break icon) 
No alert leaving the system yet (important) 

7. Outbound Behavior — Next-Gen Firewall
Tool: Cisco Secure Firewall
Detects:
Callback to attacker infra
What is happening: Compromised server attempts to communicate with external attacker-controlled infrastructure.
Traffic flow: Application Server → Firewall → External Attacker
Action:
Block connection
Generates:
Critical alert: C2 attempt
Sent to Splunk
Visual notes:
Arrow from server to outside network 
Firewall blocking the path (clear stop/block symbol) 
Alert arrow to Splunk 



8. Endpoint Detection
Tool: Cisco XDR
Detects:
Shell execution / process anomaly
What is happening: Endpoint security detects malicious execution activity on the host.
Traffic flow: Activity contained within Application Server
Action:
Kill process / isolate host
Sent to Splunk
Visual notes:
Server with process alert indicator 
Show containment (isolation boundary or lock icon) 
Alert arrow to Splunk 

9. Correlation Layer – RBA
Tool: Splunk Enterprise Security
Detects: Ties it all together using Host Application Server.
What is happening: Splunk correlates alerts across all systems and identifies a single compromised entity.
The system where:
RCE happens
Outbound callback originates
Endpoint alert triggers
This becomes an entity used for RBA detection.
Traffic flow: All alerts → Splunk → Correlated Incident
Visual notes:
Multiple arrows from all tools converging into Splunk 
Highlight single entity (Application Server) 
Final 	output: “High-confidence incident”