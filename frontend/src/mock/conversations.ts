import type { Conversation } from '../types'

export const conversations: Conversation[] = [
  {
    id: 1, userId: 1, title: 'How many days of annual leave does the company offer', kbId: 1, kbName: 'Attendance and Leave Policies', messageCount: 4, updatedAt: '2026-07-24 10:30:00',
    messages: [
      { id: 1, role: 'user', content: 'How many days of annual leave does the company offer?', citations: undefined, createdAt: '2026-07-24 10:29:00' },
      { id: 2, role: 'assistant', content: 'According to the company Attendance Management Policy v3.2, the number of paid annual leave days each employee is entitled to is tied to length of service:\n\n1. Cumulative service of 1 year but less than 10 years: **5 days**\n2. Cumulative service of 10 years but less than 20 years: **10 days**\n3. Cumulative service of 20 years or more: **15 days**\n\nAnnual leave can be taken in multiple installments, but each request must be for at least half a day. Annual leave not used within the year can be carried over to the first quarter of the following year.', citations: [{ docId: 101, title: 'Attendance Management Policy v3.2.pdf', page: 12, snippet: 'Each employee is entitled to paid annual leave... those with cumulative service of 1 year but less than 10 years are entitled to 5 days of annual leave per year...' }, { docId: 102, title: 'Annual Leave and Time-off Application Guide.docx', page: 3, snippet: 'Annual leave can be taken in multiple installments, each request at least half a day... unused annual leave can be carried over to the first quarter of the following year...' }], createdAt: '2026-07-24 10:29:30' },
      { id: 3, role: 'user', content: 'How is it calculated for newly hired employees in their first year?', createdAt: '2026-07-24 10:30:00' },
      { id: 4, role: 'assistant', content: 'Newly hired employees are not entitled to paid annual leave in their first year. According to company policy, employees may only enjoy the corresponding annual leave days for the year after completing their probation period and 12 consecutive months of work. Specifically, it is calculated starting from the hire date, and after one year the annual leave days are prorated based on the actual remaining months.', citations: [{ docId: 101, title: 'Attendance Management Policy v3.2.pdf', page: 13, snippet: 'New employees are not entitled to paid annual leave in their first year; after completing the probation period and 12 consecutive months of work...' }], createdAt: '2026-07-24 10:30:20' },
    ],
  },
  {
    id: 2, userId: 2, title: 'Deployment steps for Product A', kbId: 2, kbName: 'Product Manuals', messageCount: 2, updatedAt: '2026-07-24 09:15:00',
    messages: [
      { id: 5, role: 'user', content: 'How do I deploy Product A to the production environment?', createdAt: '2026-07-24 09:14:00' },
      { id: 6, role: 'assistant', content: 'The deployment steps for Product A are as follows:\n\n1. **Environment preparation**: JDK 17+, Maven 3.8+, MySQL 8.0+\n2. **Check out and build the code**: after `git clone`, run `mvn clean package -Pprod`\n3. **Database initialization**: run `init-db.sql` to create the tables\n4. **Configuration update**: modify the database connection and Redis address in `application-prod.yml`\n5. **Start the service**: `java -jar product-a.jar`\n6. **Health check**: visit `/actuator/health` to confirm readiness\n\nFor detailed instructions, please refer to Chapters 5-8 of the Product A User Manual.', citations: [{ docId: 201, title: 'Product A User Manual v4.0.pdf', page: 45, snippet: 'Production deployment requires ensuring that the JDK 17+, Maven 3.8+, MySQL 8.0+ environment is ready...' }], createdAt: '2026-07-24 09:15:00' },
    ],
  },
  {
    id: 3, userId: 1, title: 'Java coding standards query', kbId: 3, kbName: 'Technical Specifications and Standards', messageCount: 3, updatedAt: '2026-07-23 16:20:00',
    messages: [
      { id: 7, role: 'user', content: 'What are the naming conventions in Java?', createdAt: '2026-07-23 16:18:00' },
      { id: 8, role: 'assistant', content: 'Key points of Java coding naming conventions:\n\n- **Class names**: UpperCamelCase, e.g. `UserService`\n- **Method names**: lowerCamelCase, e.g. `getUserById`\n- **Constants**: all uppercase separated by underscores, e.g. `MAX_RETRY_COUNT`\n- **Package names**: all lowercase, e.g. `com.company.project.modules`\n- **Boolean variables**: start with is/has/can, e.g. `isActive`', citations: [{ docId: 301, title: 'Java Coding Standards v2.1.md', page: 1, snippet: 'Class names use UpperCamelCase... method names use lowerCamelCase... constants are all uppercase separated by underscores...' }], createdAt: '2026-07-23 16:19:00' },
      { id: 9, role: 'user', content: 'What are the standards for exception handling?', createdAt: '2026-07-23 16:20:00' },
      { id: 10, role: 'assistant', content: 'Exception handling standards:\n\n1. Do not ignore exceptions after catching them (empty catch blocks are not allowed)\n2. Do not use try-catch inside loops\n3. Use custom exception classes for business exceptions, extending `RuntimeException`\n4. Exception messages should include key contextual fields\n5. Avoid using exceptions for flow control', citations: [{ docId: 301, title: 'Java Coding Standards v2.1.md', page: 4, snippet: 'Exception handling: empty catch blocks are not allowed, do not use try-catch inside loops...' }], createdAt: '2026-07-23 16:20:00' },
    ],
  },
  {
    id: 4, userId: 3, title: 'Travel reimbursement standards', kbId: 4, kbName: 'Financial Reimbursement Policies', messageCount: 2, updatedAt: '2026-07-22 14:00:00',
    messages: [
      { id: 11, role: 'user', content: 'What is the accommodation allowance standard for business trips?', createdAt: '2026-07-22 13:59:00' },
      { id: 12, role: 'assistant', content: 'According to the company travel expense reimbursement rules:\n\n- **Tier-1 cities** (Beijing, Shanghai, Guangzhou, Shenzhen): 500 CNY/night\n- **Provincial capital cities**: 400 CNY/night\n- **Other cities**: 300 CNY/night\n- **Overseas business trips**: based on local mid-range hotel standards, reimbursed against receipts with a cap of 150 USD/night\n\nAmounts exceeding the standard are in principle not reimbursed; special cases require prior approval.', citations: [{ docId: 401, title: 'Travel Expense Reimbursement Rules.pdf', page: 2, snippet: 'Accommodation allowance standards: Tier-1 cities 500 CNY/night, provincial capital cities 400 CNY/night...' }], createdAt: '2026-07-22 14:00:00' },
    ],
  },
  {
    id: 5, userId: 2, title: 'Information security compliance requirements', kbId: 6, kbName: 'Security Management Standards', messageCount: 2, updatedAt: '2026-07-20 11:00:00',
    messages: [
      { id: 13, role: 'user', content: 'How is sensitive data classified?', createdAt: '2026-07-20 10:58:00' },
      { id: 14, role: 'assistant', content: 'Company data is divided into four security levels:\n\n1. **Public**: information that can be disclosed externally (product white papers, press releases)\n2. **Internal**: restricted to internal employees (policy documents, training materials)\n3. **Confidential**: restricted within a department (financial data, personnel records, technical proposals)\n4. **Top Secret**: executives and the security team (core algorithms, strategic plans)\n\nEach level corresponds to different storage, transmission, and access control policies.', citations: [{ docId: 601, title: 'Information Security Management Policy.pdf', page: 8, snippet: 'Data is divided into four levels by importance: Public, Internal, Confidential, Top Secret...' }], createdAt: '2026-07-20 11:00:00' },
    ],
  },
]
