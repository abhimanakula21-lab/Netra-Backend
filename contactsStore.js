const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "contacts.json");

// E.164 phone format check, e.g. +919876543210
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

function readAll() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read contacts.json:", err.message);
    return [];
  }
}

function writeAll(contacts) {
  fs.writeFileSync(FILE, JSON.stringify(contacts, null, 2), "utf8");
}

function isValidPhone(phone) {
  return typeof phone === "string" && PHONE_RE.test(phone.trim());
}

function addContact({ name, relation, phone, notifyVoice }) {
  if (!name || !relation || !isValidPhone(phone)) {
    throw new Error("name, relation and a valid E.164 phone (+countrycode...) are required");
  }
  const contacts = readAll();
  const contact = {
    id: "c" + Date.now(),
    name: String(name).trim(),
    relation: String(relation).trim(),
    phone: phone.trim(),
    notifyVoice: Boolean(notifyVoice)
  };
  contacts.push(contact);
  writeAll(contacts);
  return contact;
}

function removeContact(id) {
  const contacts = readAll();
  const next = contacts.filter(c => c.id !== id);
  writeAll(next);
  return next;
}

module.exports = { readAll, writeAll, addContact, removeContact, isValidPhone };
