# 🚀 XeSkillz (AssessHub) - User Guide & Documentation

Welcome to **XeSkillz**, a powerful enterprise-grade assessment platform. This document explains the system's workflow, roles, and functionalities in simple terms for everyone to understand.

---

## 🏗️ 1. Multi-Tier User Roles & Permissions

XeSkillz uses a hierarchical permission system. Access to features depends on your assigned role.

| Role | 🛡️ Description | 🔑 Key Capabilities |
| :--- | :--- | :--- |
| **Super Admin** | Platform Owner | Full visibility across all organizations, manage system settings. |
| **Admin** | Organization Lead | Onboard new staff, create custom roles, and manage team hierarchy. |
| **Manager** | Team Leader | Oversee Recruiters, track team performance, and view consolidated reports. |
| **Recruiter** | Content Creator | Manage the Question Bank, build assessments, and invite candidates. |
| **Collaborator** | Contributor | Limited access to specific assessments and report viewing. |

---

## 📂 2. Question Bank & Domains

### 🧠 Domains (Categories)
Questions are organized into **Domains**. Standard domains include:
*   **Behavioral**: Soft skills and personality traits.
*   **Arithmetic**: Basic mathematical operations.
*   **Logical Reasoning**: Patterns and deductive logic.
*   **Quantitative Aptitude**: Complex data analysis and math.
*   *Note: Admins can create **Custom Domains** specifically for your organization.*

### 📝 Question Structure
Each question contains:
1.  **Question Text**: The actual problem to solve.
2.  **Options**: 4 multiple-choice answers.
3.  **Correct Answer**: The index (1-4) of the right option.
4.  **Difficulty**: Categorized as **Easy**, **Medium**, or **Hard**.

### 📤 Bulk Upload (For Non-IT Users)
You can upload hundreds of questions at once using a **CSV file**.
**Standard CSV Format:**
`question_text, option1, option2, option3, option4, correct_answer, domain, difficulty`

---

## 📝 3. Assessment Workflow

### Step 1: Create Assessment
Build a test by choosing:
*   **Duration**: How many minutes the test lasts.
*   **Question Mix**: Select how many Easy/Medium/Hard questions you want from each Domain.
*   **Security Settings**: Enable/Disable Tab-locking or Fullscreen enforcement.

### Step 2: Invite Candidates
*   Add candidate emails manually or via bulk list.
*   The system sends a **secure, unique link** to each candidate via email.

### Step 3: Candidate Experience
*   Candidates click the link, verify their identity, and start the test.
*   The system monitors for cheating (tab switching).
*   Test auto-submits when time expires.

### Step 4: Review Results
*   Instantly view the candidate's score.
*   See performance broken down by **Domain** (e.g., "Strong in Logic, weak in Arithmetic").

---

## ⚙️ 4. Administration & Hierarchy

### 👥 User Onboarding
Admins can onboard new team members (Managers/Recruiters) by entering their email. The system automatically:
1.  Generates a secure password.
2.  Emails the login credentials to the user.
3.  Forces a password change on their first login for security.

### 🔗 Team Hierarchy
Admins can **Assign Recruiters to Managers**. 
*   This allows a Manager to see every assessment created by their assigned Recruiters.
*   Managers can track the progress of all candidates under their team.

### 🛡️ Role Builder
Don't like the standard roles? Admins can create **Custom Roles** (e.g., "Guest Interviewer") and pick exactly which buttons and pages they are allowed to see.

---

## 📧 5. Automated System Emails
The platform handles communication automatically:
*   **Welcome Emails**: Sent when a new team member is added.
*   **Test Invites**: Sent to candidates with their unique link.
*   **Password Resets**: Standard secure flow for forgotten passwords.

---

## ❓ FAQ for Non-IT Users

**Q: Can I change a test after I've sent the link?**
A: You can update the title or duration, but for security, you cannot change the question mix once a candidate has started a test.

**Q: How do I know if a candidate cheated?**
A: In the Results page, if "Security Monitoring" was on, the system will flag the number of times a candidate tried to leave the test window to search for answers.

**Q: Can I add my own company logo?**
A: Yes, branding is managed in the Organization Settings (XeSkillz branding is the default).
