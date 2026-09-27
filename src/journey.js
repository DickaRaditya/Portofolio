// Content drawn from the owner's current resume and published portfolio.
const experience = [
  {
    period: '2026 — Present', role: 'Research & Development Activist',
    organization: 'Cyber Security Community', category: 'Community',
    description: 'Contributing to the research and development division of a cybersecurity community.',
    highlights: ['Create CTF challenges and conduct research within the cybersecurity domain.'],
    skills: ['Cybersecurity research', 'CTF challenges', 'Teamwork'],
  },
  {
    period: '2026', role: 'Welcoming Party Time Keeper',
    organization: 'Cyber Security Community', category: 'Events',
    description: 'Helped keep the welcoming party running smoothly and on schedule.',
    highlights: ['Managed event timing against the predetermined schedule.'],
    skills: ['Time management', 'Coordination', 'Responsibility'],
  },
  {
    period: '2025 — 2026', role: 'Freshmen Partner',
    organization: 'Excellence Program · BINUS University', category: 'Mentoring',
    description: 'Mentored a group of 10 freshmen through the Binus Green Legacy program.',
    highlights: ['Guided the group in tree-planting initiatives to establish green spaces and support environmental sustainability.'],
    skills: ['Mentoring', 'Communication', 'Teamwork'],
  },
  {
    period: '2025', role: 'Freshmen Leader',
    organization: 'First Year Program–NEXT · BINUS University', category: 'Leadership',
    description: 'Helped new students transition into campus life during orientation.',
    highlights: ['Worked alongside a five-person team to guide students and support their participation in orientation events.'],
    skills: ['Leadership', 'Collaboration', 'Coordination'],
  },
  {
    period: '2025', role: 'Cybersecurity Education Volunteer',
    organization: 'Program Kreativitas Mahasiswa · CSC', category: 'Volunteering',
    description: 'Delivered cybersecurity education to high school students.',
    highlights: ['Introduced foundational security concepts and practical awareness for everyday digital interactions.'],
    skills: ['Security awareness', 'Communication', 'Community service'],
  },
]

const groups = [
  { id: 'all', label: 'All skills' },
  { id: 'security', label: 'Defensive security' },
  { id: 'systems', label: 'Secure systems' },
  { id: 'people', label: 'People & teamwork' },
]

const skills = [
  { title: 'Blue team operations', group: 'security', context: 'Certified foundation', description: 'Building a practical foundation in defensive security and blue team operations, supported by the Certified Blue Team Practitioner (CBTP) credential.', link: '#certificates', linkText: 'Explore my credentials' },
  { title: 'Digital forensics', group: 'security', context: 'Technical focus', description: 'Developing digital forensics knowledge as part of my cybersecurity studies and defensive security focus.', link: '#resume', linkText: 'Read my resume' },
  { title: 'CTF challenges', group: 'security', context: 'Hands-on practice', description: 'Practising through CTF challenges and the TwoMillion Hack The Box lab, alongside creating challenges in the community R&D division.', link: '#projects', linkText: 'Explore my security projects' },
  { title: 'Threat modeling', group: 'systems', context: 'Project experience', description: 'Applied STRIDE to analyze threats in TIX ID, mapping findings to OWASP Top 10, MITRE ATT&CK, and CAPEC with mitigation strategies.', link: '#projects', linkText: 'Explore the TIX-ID project' },
  { title: 'DevSecOps', group: 'systems', context: 'Project experience', description: 'Exploring security in delivery pipelines through the Policy-as-Code for Malicious Link Detection in CI/CD Pipelines project.', link: '#projects', linkText: 'Explore the DevSecOps project' },
  { title: 'IT fundamentals', group: 'systems', context: 'Academic foundation', description: 'Building a foundation in IT principles through a Computer Science degree with a Cybersecurity major at BINUS University.', link: '#resume', linkText: 'Read my education' },
  { title: 'Teamwork & collaboration', group: 'people', context: 'How I work', description: 'A cooperative team player who enjoys brainstorming together, contributing to group tasks, and getting work done efficiently.', link: '#experience', linkText: 'Explore my experience' },
  { title: 'Communication', group: 'people', context: 'Mentoring & outreach', description: 'Communicated with freshmen during mentoring and orientation, and introduced cybersecurity concepts to high school students.', link: '#experience', linkText: 'Explore mentoring & outreach' },
  { title: 'Problem solving', group: 'people', context: 'How I work', description: 'Bringing a problem-solving mindset to CTF challenges, threat modeling, and collaborative work.', link: '#projects', linkText: 'Explore my projects' },
  { title: 'Time management', group: 'people', context: 'Event experience', description: 'Managed timing for a community welcoming party to help the event follow its planned schedule.', link: '#experience', linkText: 'Explore my event experience' },
  { title: 'Adaptability & responsibility', group: 'people', context: 'How I work', description: 'An easygoing, responsible approach to working with others and contributing to a team.', link: '#about', linkText: 'More about me' },
]

const icons = {
  security: '<path d="m12 3 8 3v6c0 5-5 8-8 10-3-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/>',
  systems: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><path d="m10 10-2 2 2 2m4-4 2 2-2 2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
}

export function experienceSection() {
  return `<section id="experience"><div class="wrap">
    <div class="sectionHead"><span>03 — EXPERIENCE</span><h2>Learning through contribution.</h2><p class="meta">Community, leadership, and service. Open a role to explore what I contributed.</p></div>
    <div class="journeyLayout">
      <aside class="journeyIntro"><span class="journeyEyebrow">BEYOND THE CLASSROOM</span><h3>Security is a<br>team effort.</h3><p>From building CTF challenges to guiding new students, I learn by contributing and working with others.</p><div class="journeyNumbers"><div><strong>05</strong><span>community & campus roles</span></div><div><strong>10</strong><span>freshmen mentored together</span></div></div><a href="#skills" class="journeyLink">Explore the skills behind my work <span aria-hidden="true">↗</span></a></aside>
      <div class="experienceTimeline">${experience.map((item, index) => `<details class="experienceItem" name="experience-roles" ${index === 0 ? 'open' : ''}>
        <summary><span class="experiencePeriod">${item.period}</span><span class="experienceTitle"><strong>${item.role}</strong><span>${item.organization}</span></span><span class="disclosureMark" aria-hidden="true">+</span></summary>
        <div class="experienceBody"><span class="tag">${item.category}</span><p>${item.description}</p><ul>${item.highlights.map(text => `<li>${text}</li>`).join('')}</ul><div class="skillTags">${item.skills.map(skill => `<span>${skill}</span>`).join('')}</div></div>
      </details>`).join('')}</div>
    </div>
  </div></section>`
}

export function skillsSection() {
  return `<section id="skills"><div class="wrap">
    <div class="sectionHead"><span>04 — SKILLS</span><h2>My toolkit, in context.</h2><p class="meta">Explore my technical foundations and the people skills I bring to a team.</p></div>
    <div class="skillsControls"><div class="skillFilters" role="group" aria-label="Filter skills">${groups.map(group => `<button type="button" class="skillFilter" data-skill-filter="${group.id}" aria-pressed="${group.id === 'all'}" aria-controls="skillsGrid">${group.label}</button>`).join('')}</div><p id="skillsCount" class="meta" role="status" aria-live="polite">${skills.length} skills · select a card for details</p></div>
    <div class="skillsGrid" id="skillsGrid">${skills.map(skill => `<details class="skillCard" data-skill-group="${skill.group}"><summary><span class="skillIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[skill.group]}</svg></span><span class="skillCardTitle"><span>${skill.context}</span><strong>${skill.title}</strong></span><span class="disclosureMark" aria-hidden="true">+</span></summary><div class="skillBody"><p>${skill.description}</p><a href="${skill.link}">${skill.linkText} <span aria-hidden="true">↗</span></a></div></details>`).join('')}</div>
  </div></section>`
}

export function bindJourney(root) {
  const filters = root.querySelector('.skillFilters')
  if (!filters) return
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-skill-filter]')
    if (!button) return
    const selected = button.dataset.skillFilter
    filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    let count = 0
    root.querySelectorAll('[data-skill-group]').forEach(card => {
      card.hidden = selected !== 'all' && card.dataset.skillGroup !== selected
      if (card.hidden) card.open = false
      else count++
    })
    root.querySelector('#skillsCount').textContent = `${count} skills · select a card for details`
  })
}
