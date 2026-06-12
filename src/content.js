// Single source of truth for all portfolio content shown at stations.
// Each station: id, name (3D sign + route map), accent color, and card HTML.

export const PROFILE = {
  name: 'Navnith Bharadwaj',
  title: 'Software Engineer',
  status: 'OPEN TO WORK — SWE internships & 2027 new-grad roles'
};

export const STATIONS = [
  {
    id: 'home',
    name: 'WELCOME',
    label: 'Welcome',
    color: 0xf6c344,
    cardTitle: 'Navnith Bharadwaj',
    cardSubtitle: 'Software Engineer',
    html: `
      <p class="lead">M.S. Computer Science @ CU Boulder · ex-Oracle Software Developer</p>
      <p>I build high-performance backend services, distributed systems, and ML platforms.</p>
      <p class="status-badge">${PROFILE.status}</p>
      <p class="hint-inline">Hold <kbd>↑</kbd> to ride the line — every station is a stop on my journey. Last stop: how to reach me.</p>
    `
  },
  {
    id: 'education',
    name: 'EDUCATION',
    label: 'Education',
    color: 0x4d96ff,
    cardTitle: 'Education',
    cardSubtitle: 'Station 1',
    html: `
      <div class="entry">
        <h3>University of Colorado Boulder</h3>
        <p class="meta">M.S. Computer Science · Aug 2025 – May 2027 · GPA 3.74/4.00</p>
        <p>Big Data · Deep Learning · Neural Networks · NLP · Computer Vision</p>
      </div>
      <div class="entry">
        <h3>R V College of Engineering</h3>
        <p class="meta">B.E. Computer Science &amp; Engineering · Aug 2019 – Jul 2023</p>
        <p>Data Structures · Algorithms · Operating Systems · Software Engineering · DBMS</p>
      </div>
    `
  },
  {
    id: 'experience',
    name: 'EXPERIENCE',
    label: 'Experience',
    color: 0xff6b6b,
    cardTitle: 'Experience',
    cardSubtitle: 'Station 2',
    html: `
      <div class="entry">
        <h3>Oracle — Software Developer</h3>
        <p class="meta">Aug 2023 – Aug 2025 · Bengaluru, India</p>
        <ul>
          <li>Spearheaded a Python back-end platform on FastAPI and Ansible</li>
          <li>Architected 15+ scalable REST and GraphQL APIs with role-based access control</li>
          <li>Engineered concurrent, asynchronous, event-driven Python services</li>
        </ul>
      </div>
      <div class="entry">
        <h3>Ideoholics — Backend Developer Intern</h3>
        <p class="meta">Sept 2022 – Nov 2022 · Remote</p>
        <ul>
          <li>Shipped scalable Java + Spring Boot REST APIs in a microservices architecture</li>
          <li>Hardened 300+ API endpoints with encryption and access controls</li>
        </ul>
      </div>
    `
  },
  {
    id: 'skills',
    name: 'SKILLS',
    label: 'Skills',
    color: 0x52c41a,
    cardTitle: 'Skills',
    cardSubtitle: 'Station 3',
    html: `
      <div class="skill-group"><h4>Languages</h4><div class="chips">
        <span>Python</span><span>Java</span><span>C++</span><span>JavaScript</span><span>SQL</span><span>Bash</span>
      </div></div>
      <div class="skill-group"><h4>Frameworks &amp; APIs</h4><div class="chips">
        <span>FastAPI</span><span>Spring Boot</span><span>Node.js</span><span>REST</span><span>GraphQL</span><span>gRPC</span><span>Microservices</span>
      </div></div>
      <div class="skill-group"><h4>Cloud &amp; DevOps</h4><div class="chips">
        <span>AWS</span><span>GCP</span><span>Azure</span><span>Docker</span><span>Kubernetes</span><span>CI/CD</span><span>Git</span><span>Unix/Linux</span>
      </div></div>
      <div class="skill-group"><h4>Databases</h4><div class="chips">
        <span>PostgreSQL</span><span>MySQL</span><span>MongoDB</span><span>Redis</span>
      </div></div>
    `
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    label: 'Projects',
    color: 0xb368f0,
    cardTitle: 'Projects',
    cardSubtitle: 'Station 4',
    html: `
      <div class="entry">
        <h3>MeshML</h3>
        <p>Fault-tolerant microservices platform bridging local development and cloud-scale training.</p>
      </div>
      <div class="entry">
        <h3>ML Model A/B Testing Framework</h3>
        <p>High-performance FastAPI service with consistent-hashing request routing.</p>
      </div>
      <div class="entry">
        <h3>F1 Telemetry Data Pipeline</h3>
        <p>Async FastAPI backend processing live telemetry.</p>
      </div>
      <div class="entry">
        <h3>Equity Options Portfolio Optimizer</h3>
        <p>Implementation of a research paper on enhanced index tracking.</p>
      </div>
    `
  },
  {
    id: 'contact',
    name: 'CONTACT',
    label: 'Contact',
    color: 0xff9f43,
    cardTitle: 'End of the Line',
    cardSubtitle: "Let's connect",
    html: `
      <p class="lead">Thanks for riding! Here's how to reach me:</p>
      <div class="contact-links">
        <a href="mailto:bharadwajnavnith5@gmail.com">✉️ bharadwajnavnith5@gmail.com</a>
        <a href="tel:+17207253458">📞 +1 (720) 725-3458</a>
        <a href="https://github.com/navnithb2001" target="_blank" rel="noopener">⌨️ github.com/navnithb2001</a>
        <a href="https://linkedin.com/in/navnithbharadwaj" target="_blank" rel="noopener">💼 linkedin.com/in/navnithbharadwaj</a>
      </div>
      <p class="meta">📍 Boulder, Colorado</p>
      <p class="status-badge">${PROFILE.status}</p>
    `
  }
];
