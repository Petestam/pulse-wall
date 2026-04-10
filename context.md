# Project Context File
Project: Enterprise Security and Observability Visualization Platform  
Client: Splunk  
Status: Greenlit  
Last Updated: With confirmed scenario count and visualization approach

---

# Project Summary
This project will deliver a **software-driven enterprise visualization and demonstration platform** for a live event environment. The system will simulate enterprise activity and demonstrate security and observability workflows through interactive kiosk experiences that trigger real-time changes on a large-format visualization wall.

The platform will be used in a **live trade show booth environment** and must operate reliably for long daily runtimes while allowing operators to manage demonstrations and reset the system quickly between visitors.

Vendor scope is limited to **design, software development, and on-site operational support**. All physical infrastructure is handled by other vendors.

---

# Core Purpose
Create a simulated enterprise environment that allows complex security and observability stories to be **visible, interactive, and understandable in a live event setting**.

The system should:

• visualize enterprise infrastructure and activity in motion  
• demonstrate pre-scripted security and observability scenarios  
• allow attendee interaction through kiosks  
• update the visualization wall in response to those interactions  
• operate continuously in a live event environment  
• be easily controlled by operators during the show

---

# Budget Framework (Approved)
Total Budget: **~$112K**

Breakdown:

Creative Direction / Production Fees  
$22K

Visual Design + UI  
$12K

Creative Technology + Software Development  
$42K

On-Site Support  
$30K

Program fee and overhead accounted for within project totals.

---

# Scope Definition

## In Scope

• experience design related to the software platform  
• visualization design language for enterprise topology  
• UI design for kiosk interfaces  
• software architecture and development  
• scenario framework implementation  
• telemetry simulation engine  
• visualization software platform  
• kiosk application software  
• operator control console  
• deployment coordination related to software systems  
• on-site technical support and operation

## Out of Scope

Handled by GPJ or other vendors:

• LED wall fabrication and installation  
• AV hardware  
• playback hardware and video processing  
• booth construction  
• kiosk hardware and enclosures  
• structural installation  
• fabrication and graphics  
• freight  
• physical integration labor

---

# System Overview

The system will simulate a **large enterprise environment** and demonstrate how security and observability teams detect and respond to incidents.

The platform consists of several connected software systems:

1. Enterprise simulation model  
2. Scenario framework and scenario scripts  
3. Telemetry simulation engine  
4. Kiosk investigation interfaces  
5. Real-time visualization system for LED wall  
6. Operator control console

---

# Experience Modes

The system must support three operational modes:

Security Mode  
Simulates cyber attack detection and response workflows.

Observability Mode  
Simulates infrastructure or application performance incidents.

Unified Operations Mode  
Simulates collaboration between security and observability teams.

---

# Scenario Count (Confirmed)

Client confirmed approximately:

**4 scenarios per mode**

Total scenarios: **~12**

Security Mode  
~4 scenarios

Observability Mode  
~4 scenarios

Unified Mode  
~4 scenarios

---

# Visualization Strategy

Visualizations should remain **mostly consistent across scenarios**.

Instead of creating unique visuals for each scenario, the system will use **a limited set of reusable visualization behaviors**.

Estimated total visual systems: **~8–10 visualization states**

Examples include:

• baseline enterprise activity  
• threat ingress  
• lateral movement  
• containment deployment  
• service degradation  
• network congestion  
• anomaly detection  
• recovery state  
• cross-domain impact  
• system stabilization

Mode relationships:

Security Mode  
Uses security visualization set.

Observability Mode  
Uses observability visualization set.

Unified Mode  
Uses combined overlays from both systems.

Scenarios will trigger sequences of these visual states.

---

# Scenario Architecture

Scenarios will be defined through **configuration files (JSON or XML)** rather than through a custom editing interface.

Each scenario will define:

• event sequence  
• signals generated  
• kiosk interaction prompts  
• remediation choices  
• visualization states triggered

This approach allows the platform to remain flexible without requiring the development of a full scenario editing UI.

Example conceptual structure:

```
Scenario
mode: security
id: lateral_movement_attack

events
  - baseline
  - intrusion_detected
  - lateral_movement
  - kiosk_alert
  - remediation_choice
  - containment_deployed
  - recovery
```

Scenario configuration files can be edited by the internal team.

A future phase may introduce a **web-based scenario editor**, but this is not included in the current scope.

---

# Investigation Interaction Model (Confirmed)

The kiosk investigation experience will follow a **guided interaction model** rather than a complex exploratory interface.

Interaction sequence:

1. Alert appears on screen  
2. User clicks alert to open investigation  
3. Screen shows simulated telemetry data  
4. Root cause is highlighted  
5. User selects one of several remediation actions  
6. The remediation action deploys  
7. The visualization wall reflects the action

Each investigation will present **3–4 remediation options**.

The goal is to allow the attendee to make a decision and immediately see the impact on the enterprise environment.

---

# Interface Style

Investigation interfaces will use an **AI Canvas style interaction model** rather than complex network navigation tools.

This allows the experience to:

• simplify user interaction  
• avoid complex topology exploration tools  
• maintain clarity for event audiences  
• reduce development complexity

The interface will function as a **contextual workspace** displaying alerts, signals, and remediation choices.

---

# Telemetry Simulation

The system will generate **synthetic telemetry signals** required to support scenarios.

Signals may include:

Security signals

• authentication activity  
• endpoint alerts  
• DNS activity  
• network flows  
• firewall alerts  
• command-and-control indicators

Operational signals

• service latency  
• resource utilization spikes  
• application failures  
• service dependency issues  
• congestion indicators

Telemetry will be generated by the simulation engine and **not connected to real infrastructure**.

---

# Visualization System

The LED wall visualization will represent:

• enterprise topology  
• traffic flows  
• node health states  
• security events  
• service disruptions  
• remediation deployment  
• system recovery

The visualization will follow a **diagrammatic / network topology style** rather than photorealistic rendering.

---

# Idle Mode

When no scenario is active, the wall will display a **healthy enterprise baseline** including:

• normal traffic flows  
• service interactions  
• light background system activity

Idle mode should be visually engaging but not distracting.

---

# Kiosk System

Multiple kiosk stations will allow attendees to interact with the simulation.

Requirements:

• multiple kiosks supported simultaneously  
• each kiosk controls its own scenario instance  
• each kiosk scenario triggers updates on the wall  
• scenarios remain synchronized with the central engine

The system must support **at least four concurrent kiosk scenarios**.

---

# Operator Control Console

Operators must be able to:

• start and stop scenarios  
• select experience modes  
• manually trigger scenario stages  
• reset the system  
• override kiosk interactions if necessary

The console will likely be a **web-based control panel** on the local network.

---

# Operational Requirements

System must support:

• 10+ hours of daily operation  
• offline operation on local network  
• fast reset between demos  
• concurrent kiosk sessions

Target reset time: ~30 seconds to return to Idle Mode.

---

# Key Dependencies

The platform depends heavily on input from **Splunk TME**.

Splunk TME is expected to provide:

• enterprise topology model  
• scenario narratives  
• event sequences  
• telemetry signal types  
• investigation workflows  
• expected visualization states

---

# Content Delivery Milestone

Requested from client:

**Scenario definitions or placeholder content by April 1**

This allows development to begin with:

• event sequences  
• signal types  
• remediation options  
• visualization outcomes

Even rough placeholders are sufficient to begin building the simulation engine.

---

# Development Guardrails

To keep the project within the approved budget:

• scenario authoring will use configuration files  
• visualization behaviors will be reusable across scenarios  
• investigation UI will follow a single interaction template  
• platform will support scenario scripting but not full visual editing tools  
• kiosk workflows remain guided rather than exploratory

---

# Key Risks

Primary risk: **scenario complexity expansion**

Risk drivers:

• scenarios becoming highly branching  
• investigation UI expanding into full analysis tools  
• additional visualization systems being requested  
• telemetry simulation becoming highly detailed  
• integration responsibilities expanding beyond software

---

# Project Philosophy

This system should be treated as a **first-generation demonstration platform**.

It should be:

• flexible enough to run multiple scenarios  
• visually compelling and easy to understand  
• reliable during live operation  
• extensible through configuration files

It should **not attempt to become a full simulation product or scenario authoring platform** in phase one.

---

# Experience Goal

Visitors should be able to:

see an enterprise system in motion  
identify a problem through an alert  
make a decision about how to respond  
watch their action affect the entire network

The wall should communicate system state changes instantly and clearly, allowing audiences to understand the narrative of the scenario even without deep technical knowledge.

---

# Next Steps

1. Confirm scenario structure with Splunk TME  
2. Receive initial scenario content (or placeholders) by April 1  
3. Define enterprise topology visualization system  
4. Define telemetry signal types  
5. Design kiosk interaction UI  
6. Begin simulation engine architecture  
7. Begin visualization system development