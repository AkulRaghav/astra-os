-- Seed data for development

-- Default billing plans
INSERT INTO billing_plans (id, name, tier, price_monthly, price_yearly, features, limits) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'Free',
    'free',
    0.00,
    0.00,
    ARRAY['5GB Storage', '50 AI requests/day', '1 workspace', '5 plugins'],
    '{"storageGb": 5, "aiRequestsPerDay": 50, "maxCollaborators": 1, "maxPlugins": 5}'
),
(
    'a0000000-0000-0000-0000-000000000002',
    'Pro',
    'pro',
    19.99,
    199.99,
    ARRAY['100GB Storage', 'Unlimited AI requests', '10 workspaces', 'Unlimited plugins', 'Priority support', 'Advanced AI agents'],
    '{"storageGb": 100, "aiRequestsPerDay": -1, "maxCollaborators": 10, "maxPlugins": -1}'
),
(
    'a0000000-0000-0000-0000-000000000003',
    'Enterprise',
    'enterprise',
    49.99,
    499.99,
    ARRAY['Unlimited storage', 'Unlimited AI requests', 'Unlimited workspaces', 'Unlimited plugins', 'Dedicated support', 'Custom AI agents', 'SSO/SAML', 'Audit logs', 'SLA'],
    '{"storageGb": -1, "aiRequestsPerDay": -1, "maxCollaborators": -1, "maxPlugins": -1}'
);

-- Built-in AI agents
INSERT INTO ai_agents (id, name, type, description, capabilities, model, is_active, is_builtin, config) VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'AI Assistant',
    'assistant',
    'General-purpose AI assistant for everyday tasks',
    ARRAY['chat', 'summarize', 'explain', 'brainstorm', 'translate'],
    'gpt-4-turbo-preview',
    TRUE,
    TRUE,
    '{"systemPrompt": "You are Astra, a helpful AI assistant integrated into the Astra operating system. Help users with their tasks efficiently and clearly.", "temperature": 0.7, "maxTokens": 4096}'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'Code Helper',
    'code_helper',
    'AI-powered code generation, debugging, and explanation',
    ARRAY['code_generation', 'debugging', 'code_review', 'refactoring', 'documentation'],
    'gpt-4-turbo-preview',
    TRUE,
    TRUE,
    '{"systemPrompt": "You are Astra Code Helper, an expert programming assistant. Help users write, debug, review, and improve code. Always provide clear explanations.", "temperature": 0.3, "maxTokens": 8192}'
),
(
    'b0000000-0000-0000-0000-000000000003',
    'Data Analyst',
    'data_analyst',
    'Analyze data, generate insights, and create visualizations',
    ARRAY['data_analysis', 'visualization', 'statistics', 'reporting', 'sql'],
    'gpt-4-turbo-preview',
    TRUE,
    TRUE,
    '{"systemPrompt": "You are Astra Data Analyst. Help users analyze data, identify patterns, generate insights, and create reports.", "temperature": 0.5, "maxTokens": 4096}'
),
(
    'b0000000-0000-0000-0000-000000000004',
    'Content Writer',
    'content_writer',
    'Draft documents, emails, and creative content',
    ARRAY['writing', 'editing', 'formatting', 'translation', 'tone_adjustment'],
    'gpt-4-turbo-preview',
    TRUE,
    TRUE,
    '{"systemPrompt": "You are Astra Content Writer. Help users create clear, engaging content for various purposes including emails, documents, and creative writing.", "temperature": 0.8, "maxTokens": 4096}'
),
(
    'b0000000-0000-0000-0000-000000000005',
    'Researcher',
    'researcher',
    'Web search, summarization, and research synthesis',
    ARRAY['web_search', 'summarization', 'fact_checking', 'citation', 'comparison'],
    'gpt-4-turbo-preview',
    TRUE,
    TRUE,
    '{"systemPrompt": "You are Astra Researcher. Help users find information, synthesize research, verify facts, and compile comprehensive answers with citations.", "temperature": 0.5, "maxTokens": 4096}'
);

-- Sample plugins for marketplace
INSERT INTO plugins (id, name, slug, description, version, author, category, tags, downloads, rating, is_official, pricing) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'GitHub Integration',
    'github-integration',
    'Connect your GitHub repositories, view PRs, issues, and manage code directly from Astra',
    '1.0.0',
    'Astra Team',
    'development',
    ARRAY['github', 'git', 'code', 'repository'],
    15420,
    4.80,
    TRUE,
    'free'
),
(
    'c0000000-0000-0000-0000-000000000002',
    'Slack Integration',
    'slack-integration',
    'Send and receive Slack messages, manage channels, and get notifications within Astra',
    '1.0.0',
    'Astra Team',
    'communication',
    ARRAY['slack', 'messaging', 'team', 'chat'],
    12850,
    4.70,
    TRUE,
    'free'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'Notion Sync',
    'notion-sync',
    'Two-way sync between Astra Notes and Notion pages and databases',
    '0.9.0',
    'Astra Team',
    'productivity',
    ARRAY['notion', 'notes', 'sync', 'wiki'],
    8920,
    4.50,
    TRUE,
    'freemium'
),
(
    'c0000000-0000-0000-0000-000000000004',
    'Figma Connect',
    'figma-connect',
    'View Figma designs, export assets, and collaborate on designs within Astra',
    '1.0.0',
    'Astra Team',
    'design',
    ARRAY['figma', 'design', 'ui', 'assets'],
    6780,
    4.60,
    TRUE,
    'free'
),
(
    'c0000000-0000-0000-0000-000000000005',
    'Linear Integration',
    'linear-integration',
    'Manage Linear issues, projects, and cycles directly from Astra Tasks',
    '1.0.0',
    'Astra Team',
    'productivity',
    ARRAY['linear', 'project-management', 'issues', 'agile'],
    5430,
    4.70,
    TRUE,
    'free'
);
