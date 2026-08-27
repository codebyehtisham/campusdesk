export type AdmissionFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'select'
  | 'file'
  | 'cnic';

export type AdmissionField = {
  id: string;
  key: string;
  label: string;
  type: AdmissionFieldType;
  required: boolean;
  options: string[];
  maxFileMb: number;
  accept: string;
  placeholder: string;
  helpText: string;
  sortOrder: number;
};

export type AdmissionGroup = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  fields: AdmissionField[];
};

export type AdmissionForm = {
  published: boolean;
  intro: string;
  groups: AdmissionGroup[];
};

const FIELD_TYPES: AdmissionFieldType[] = [
  'text',
  'textarea',
  'email',
  'tel',
  'number',
  'date',
  'select',
  'file',
  'cnic',
];

/** Pakistani CNIC: 34209-9090987-0 (13 digits, 15 chars with hyphens). */
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;
export const CNIC_MAX_DIGITS = 13;
export const CNIC_MAX_LENGTH = 15;

export const formatCnic = (raw: unknown) => {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, CNIC_MAX_DIGITS);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export const isCnicField = (field: { type?: string; key?: string }) =>
  field?.type === 'cnic' || String(field?.key || '').toLowerCase() === 'cnic';

export const isValidCnic = (value: unknown) => CNIC_PATTERN.test(formatCnic(value));

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

const slugKey = (value: string, fallback: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return cleaned || fallback;
};

export const emptyAdmissionForm = (): AdmissionForm => ({
  published: false,
  intro: '',
  groups: [],
});

export const defaultAdmissionForm = (): AdmissionForm => ({
  published: true,
  intro: 'Complete each section carefully. Required fields are marked. Upload clear copies of your documents.',
  groups: [
    {
      id: 'personal',
      title: 'Personal information',
      description: 'Name, CNIC, contacts, and guardian details.',
      sortOrder: 0,
      fields: [
        {
          id: 'full_name',
          key: 'full_name',
          label: 'Full name',
          type: 'text',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: 'As on CNIC',
          helpText: '',
          sortOrder: 0,
        },
        {
          id: 'cnic',
          key: 'cnic',
          label: 'CNIC / B-Form',
          type: 'cnic',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: '34209-9090987-0',
          helpText: 'Format: 34209-9090987-0 (15 characters)',
          sortOrder: 1,
        },
        {
          id: 'phone',
          key: 'phone',
          label: 'Mobile number',
          type: 'tel',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: '03xx xxxxxxx',
          helpText: '',
          sortOrder: 2,
        },
        {
          id: 'guardian_name',
          key: 'guardian_name',
          label: 'Guardian name',
          type: 'text',
          required: false,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: '',
          helpText: '',
          sortOrder: 3,
        },
      ],
    },
    {
      id: 'program',
      title: 'Program choice',
      description: 'Choose the programme you are applying for.',
      sortOrder: 1,
      fields: [
        {
          id: 'program',
          key: 'program',
          label: 'Programme',
          type: 'select',
          required: true,
          options: ['BSN', 'Post-RN BSN', 'Diploma in Midwifery', 'Allied Health'],
          maxFileMb: 5,
          accept: '',
          placeholder: '',
          helpText: '',
          sortOrder: 0,
        },
      ],
    },
    {
      id: 'academic',
      title: 'Academic record',
      description: 'Matric and intermediate results.',
      sortOrder: 2,
      fields: [
        {
          id: 'matric_marks',
          key: 'matric_marks',
          label: 'Matric marks / grade',
          type: 'text',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: '',
          helpText: '',
          sortOrder: 0,
        },
        {
          id: 'fsc_marks',
          key: 'fsc_marks',
          label: 'FSc / Intermediate marks',
          type: 'text',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: '',
          placeholder: '',
          helpText: '',
          sortOrder: 1,
        },
      ],
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Upload clear scans. Max size is set per document.',
      sortOrder: 3,
      fields: [
        {
          id: 'photo',
          key: 'photo',
          label: 'Passport photo',
          type: 'file',
          required: true,
          options: [],
          maxFileMb: 2,
          accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
          placeholder: '',
          helpText: 'Recent passport-size photo',
          sortOrder: 0,
        },
        {
          id: 'cnic_scan',
          key: 'cnic_scan',
          label: 'CNIC scan',
          type: 'file',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: 'image/*,.pdf',
          placeholder: '',
          helpText: '',
          sortOrder: 1,
        },
        {
          id: 'matric_cert',
          key: 'matric_cert',
          label: 'Matric certificate / result',
          type: 'file',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: 'image/*,.pdf',
          placeholder: '',
          helpText: '',
          sortOrder: 2,
        },
        {
          id: 'fsc_cert',
          key: 'fsc_cert',
          label: 'FSc certificate / result',
          type: 'file',
          required: true,
          options: [],
          maxFileMb: 5,
          accept: 'image/*,.pdf',
          placeholder: '',
          helpText: '',
          sortOrder: 3,
        },
      ],
    },
  ],
});

export const parseAdmissionForm = (raw: unknown): AdmissionForm => {
  if (!raw || typeof raw !== 'object') return emptyAdmissionForm();
  const data = raw as Record<string, unknown>;
  const groupsIn = Array.isArray(data.groups) ? data.groups : [];
  const groups: AdmissionGroup[] = groupsIn.map((group, gi) => {
    const g = (group && typeof group === 'object' ? group : {}) as Record<string, unknown>;
    const fieldsIn = Array.isArray(g.fields) ? g.fields : [];
    const fields: AdmissionField[] = fieldsIn.map((field, fi) => {
      const f = (field && typeof field === 'object' ? field : {}) as Record<string, unknown>;
      const type = FIELD_TYPES.includes(f.type as AdmissionFieldType)
        ? (f.type as AdmissionFieldType)
        : 'text';
      const label = clip(f.label, 120) || `Field ${fi + 1}`;
      const key = slugKey(clip(f.key, 64) || label, `field_${fi + 1}`);
      const options = Array.isArray(f.options)
        ? f.options.map((opt) => clip(opt, 80)).filter(Boolean).slice(0, 40)
        : [];
      const maxFileMb = Math.min(25, Math.max(0.5, Number(f.maxFileMb) || 5));
      return {
        id: clip(f.id, 64) || `f_${gi}_${fi}`,
        key,
        label,
        type,
        required: f.required !== false,
        options,
        maxFileMb,
        accept: clip(f.accept, 120),
        placeholder: clip(f.placeholder, 120),
        helpText: clip(f.helpText, 240),
        sortOrder: Number.isFinite(Number(f.sortOrder)) ? Number(f.sortOrder) : fi,
      };
    });
    fields.sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: clip(g.id, 64) || `g_${gi}`,
      title: clip(g.title, 120) || `Section ${gi + 1}`,
      description: clip(g.description, 400),
      sortOrder: Number.isFinite(Number(g.sortOrder)) ? Number(g.sortOrder) : gi,
      fields,
    };
  });
  groups.sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    published: Boolean(data.published),
    intro: clip(data.intro, 800),
    groups,
  };
};

export const sanitizeAdmissionFormInput = (raw: unknown): AdmissionForm => {
  const form = parseAdmissionForm(raw);
  const usedKeys = new Set<string>();
  form.groups.forEach((group, gi) => {
    group.fields.forEach((field, fi) => {
      let key = field.key;
      let n = 2;
      while (usedKeys.has(key)) {
        key = `${field.key}_${n++}`.slice(0, 48);
      }
      usedKeys.add(key);
      field.key = key;
      field.sortOrder = fi;
    });
    group.sortOrder = gi;
  });
  return form;
};

export const flattenFields = (form: AdmissionForm) =>
  form.groups.flatMap((group) => group.fields.map((field) => ({ ...field, groupTitle: group.title })));

export const publicAdmissionForm = (form: AdmissionForm) => ({
  published: form.published,
  intro: form.intro,
  groups: form.groups.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    sortOrder: group.sortOrder,
    fields: group.fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options,
      maxFileMb: field.maxFileMb,
      accept: field.accept,
      placeholder: field.placeholder,
      helpText: field.helpText,
      sortOrder: field.sortOrder,
    })),
  })),
});

export type AnswerMap = Record<string, unknown>;

export const asAnswerMap = (raw: unknown): AnswerMap => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as AnswerMap;
      return {};
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as AnswerMap) };
};

export const stringifyAnswers = (answers: AnswerMap) => JSON.stringify(answers || {});

export const parseStoredAdmissionForm = (raw: unknown) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
};

export const validateAnswers = (form: AdmissionForm, answers: AnswerMap) => {
  const errors: string[] = [];
  for (const field of flattenFields(form)) {
    let value = answers[field.key];
    if (isCnicField(field) && value != null && value !== '') {
      value = formatCnic(value);
      answers[field.key] = value;
    }
    const empty =
      value == null ||
      value === '' ||
      (typeof value === 'object' && value !== null && !(value as { url?: string }).url);
    if (field.required && empty) {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (empty) continue;
    if (isCnicField(field) && !isValidCnic(value)) {
      errors.push(`${field.label} must look like 34209-9090987-0.`);
    }
    if (field.type === 'select' && field.options.length && !field.options.includes(String(value))) {
      errors.push(`${field.label} has an invalid option.`);
    }
    if (field.type === 'file') {
      const file = value as { url?: string; name?: string; size?: number };
      if (!file?.url) {
        errors.push(`${field.label} needs a file upload.`);
        continue;
      }
      const maxBytes = field.maxFileMb * 1024 * 1024;
      if (typeof file.size === 'number' && file.size > maxBytes) {
        errors.push(`${field.label} must be ${field.maxFileMb} MB or smaller.`);
      }
    }
  }
  return errors;
};
