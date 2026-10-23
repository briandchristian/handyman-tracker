/**
 * People associated with a business customer.
 * A private individual does not use this list.
 */
import { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import SectionToggle from './SectionToggle';

function formatPhoneNumber(value) {
  const phoneNumber = String(value || '').replace(/\D/g, '');
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

const emptyPerson = () => ({ name: '', role: '', phone: '', email: '' });
const fieldClass = 'w-full p-2 border border-slate-300 rounded bg-white text-slate-900';

export default function CustomerPeople({ customer, onSaved }) {
  const people = customer.people || [];
  const [form, setForm] = useState(emptyPerson);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  const editPerson = (person) => {
    setEditingId(person._id);
    setForm({
      name: person.name || '',
      role: person.role || '',
      phone: person.phone || '',
      email: person.email || '',
    });
    setError('');
    setFormOpen(true);
  };

  const savePerson = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (editingId) {
        await axios.put(
          `${API_BASE_URL}/api/customers/${customer._id}/people/${editingId}`,
          form,
          auth
        );
      } else {
        await axios.post(`${API_BASE_URL}/api/customers/${customer._id}/people`, form, auth);
      }
      setForm(emptyPerson());
      setEditingId(null);
      setFormOpen(false);
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save person');
    }
  };

  const deletePerson = async (person) => {
    if (!window.confirm(`Remove ${person.name} from this business?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customer._id}/people/${person._id}`, auth);
      if (editingId === person._id) {
        setEditingId(null);
        setForm(emptyPerson());
        setFormOpen(false);
      }
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to remove person');
    }
  };

  return (
    <SectionToggle title="People" className="mb-6">
      <p className="text-sm text-slate-600 mb-4">
        Individuals associated with this business. A private individual is the person and their home, so this list is only for a company.
      </p>
      {people.length === 0 ? (
        <p className="text-slate-600 mb-4">No people on this business yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {people.map((person) => (
            <article key={person._id} data-testid={`person-${person._id}`} className="border border-slate-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{person.name}</h3>
                  {person.role ? <p className="text-sm text-slate-600">{person.role}</p> : null}
                  <p className="text-sm">{person.phone || '—'}</p>
                  <p className="text-sm">{person.email || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-row btn-row-secondary" onClick={() => editPerson(person)}>Edit</button>
                  <button type="button" className="btn-row btn-row-danger" onClick={() => deletePerson(person)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <SectionToggle
        nested
        title={editingId ? 'Edit person' : 'New person'}
        open={formOpen}
        onOpenChange={setFormOpen}
      >
      <form aria-label="Person" onSubmit={savePerson}>
        {error ? <p role="alert" className="text-red-700 mb-3">{error}</p> : null}
        <AlignedFormGrid className="mb-3">
          <AlignedFormField label="Person name" htmlFor="person-name" className="col-span-12 md:col-span-4">
            <input id="person-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} />
          </AlignedFormField>
          <AlignedFormField label="Role" htmlFor="person-role" className="col-span-12 md:col-span-3">
            <input id="person-role" placeholder="Owner, billing, site contact" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={fieldClass} />
          </AlignedFormField>
          <AlignedFormField label="Person phone" htmlFor="person-phone" className="col-span-12 md:col-span-2">
            <input
              id="person-phone"
              value={form.phone}
              maxLength="12"
              onChange={(event) => setForm({ ...form, phone: formatPhoneNumber(event.target.value) })}
              className={fieldClass}
            />
          </AlignedFormField>
          <AlignedFormField label="Person email" htmlFor="person-email" className="col-span-12 md:col-span-3">
            <input id="person-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} />
          </AlignedFormField>
        </AlignedFormGrid>
        <button type="submit" className="btn-primary">
          {editingId ? 'Save person' : 'Add person'}
        </button>
      </form>
      </SectionToggle>
    </SectionToggle>
  );
}
