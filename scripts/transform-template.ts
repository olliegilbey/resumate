/**
 * Transform resume-data-template.json to new schema
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, '..', 'data', 'resume-data-template.json');
const data = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

// Transform to new schema
const transformed: any = {
  personal: {
    name: data.personal.fullName || data.personal.name,
    nickname: data.personal.nickname || null,
    email: data.personal.email || null,
    phone: data.personal.phone || null,
    location: data.personal.location || null,
    linkedin: data.personal.linkedin || null,
    github: data.personal.github || null,
    website: data.personal.website || null,
    twitter: data.personal.twitter || null,
    tagline: data.tagline || null
  },
  summary: data.summary || null,
  experience: (data.companies || []).map((c: any) => ({
    id: c.id,
    name: c.name || null,
    dateStart: c.dateRange?.start || c.dateStart,
    dateEnd: c.dateRange?.end || c.dateEnd || null,
    location: c.location || null,
    description: c.context || c.description || null,
    priority: c.companyPriority || c.priority || 5,
    tags: c.companyTags || c.tags || [],
    summary: c.summary || null,
    link: c.link || null,
    children: (c.positions || []).map((p: any) => ({
      id: p.id,
      name: p.role || p.name,
      dateStart: p.dateRange?.start || p.dateStart,
      dateEnd: p.dateRange?.end || p.dateEnd || null,
      description: p.description,
      priority: p.descriptionPriority || p.priority || 5,
      tags: p.descriptionTags || p.tags || [],
      summary: p.descriptionContext || p.summary || null,
      link: p.descriptionLink || p.link || null,
      location: p.location || null,
      children: (p.bullets || p.children || []).map((b: any) => ({
        id: b.id,
        description: b.text || b.description,
        tags: b.tags || [],
        priority: b.priority || 5,
        summary: b.context || b.summary || null,
        link: b.link || null,
        dateStart: b.dateRange?.start || b.dateStart || null,
        dateEnd: b.dateRange?.end || b.dateEnd || null,
        location: b.location || null,
        name: b.name || null
      }))
    }))
  })),
  skills: data.skills || null,
  education: data.education || null,
  roleProfiles: data.roleProfiles || null
};

// Write back
fs.writeFileSync(templatePath, JSON.stringify(transformed, null, 2) + '\n');

console.log('✅ Template transformed to new schema');
console.log(`📄 Updated: ${templatePath}`);
