import fs from 'node:fs';
import path from 'node:path';

const validCareLevels = new Set(['routine', 'doctor', 'emergency']);

function fail(message) {
  throw new Error(message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStringArray(value, fieldName, filePath, lineNumber) {
  if (!Array.isArray(value) || value.some(item => !isNonEmptyString(item))) {
    fail(
      `${filePath}:${lineNumber} ${fieldName} must be an array of non-empty strings.`,
    );
  }
}

function validateSupervisedExample(record, filePath, lineNumber) {
  if (!isNonEmptyString(record.instruction)) {
    fail(`${filePath}:${lineNumber} instruction must be a non-empty string.`);
  }

  if (!isNonEmptyString(record.response)) {
    fail(`${filePath}:${lineNumber} response must be a non-empty string.`);
  }

  if (!validCareLevels.has(record.careLevel)) {
    fail(
      `${filePath}:${lineNumber} careLevel must be one of routine, doctor, emergency.`,
    );
  }

  validateStringArray(record.sources, 'sources', filePath, lineNumber);
}

function validateEvalExample(record, filePath, lineNumber) {
  if (!isNonEmptyString(record.userMessage)) {
    fail(`${filePath}:${lineNumber} userMessage must be a non-empty string.`);
  }

  if (!validCareLevels.has(record.expectedCareLevel)) {
    fail(
      `${filePath}:${lineNumber} expectedCareLevel must be one of routine, doctor, emergency.`,
    );
  }

  if (record.mustMention !== undefined) {
    validateStringArray(record.mustMention, 'mustMention', filePath, lineNumber);
  }

  if (record.mustNotMention !== undefined) {
    validateStringArray(
      record.mustNotMention,
      'mustNotMention',
      filePath,
      lineNumber,
    );
  }

  validateStringArray(record.sources, 'sources', filePath, lineNumber);
}

function validateRecord(record, filePath, lineNumber) {
  if (record && typeof record === 'object' && 'instruction' in record) {
    validateSupervisedExample(record, filePath, lineNumber);
    return;
  }

  if (record && typeof record === 'object' && 'userMessage' in record) {
    validateEvalExample(record, filePath, lineNumber);
    return;
  }

  fail(
    `${filePath}:${lineNumber} record must match either the supervised or evaluation schema.`,
  );
}

function validateFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const contents = fs.readFileSync(absolutePath, 'utf8');
  const lines = contents.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    fail(`${filePath} does not contain any JSONL records.`);
  }

  lines.forEach((line, index) => {
    let record;

    try {
      record = JSON.parse(line);
    } catch {
      fail(`${filePath}:${index + 1} is not valid JSON.`);
    }

    validateRecord(record, filePath, index + 1);
  });

  console.log(`Validated ${lines.length} records in ${filePath}`);
}

const filePaths = process.argv.slice(2);

if (filePaths.length === 0) {
  fail('Pass at least one JSONL file to validate.');
}

filePaths.forEach(validateFile);
