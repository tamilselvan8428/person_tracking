import { useState } from 'react'
import { useAuth } from '../store/auth'
import '../styles/pages/Contact.css'
import emailjs from '@emailjs/browser'

export default function Contact() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  if (!user) return <p>Please login.</p>

  const onSubmit = async (e) => {
    e.preventDefault()
    setStatus('')
    if (!name || !email || !message) {
      setStatus('Please fill in name, email and your message.')
      return
    }

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    if (!serviceId || !templateId || !publicKey) {
      setStatus('Email service is not configured. Please set VITE_EMAILJS_* env vars.')
      return
    }

    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          from_name: name,
          from_email: email,
          reply_to: email,
          phone,
          message,
        },
        { publicKey }
      )
      setStatus('Your query has been submitted. We will contact you shortly.')
      setName(''); setPhone(''); setEmail(''); setMessage('')
    } catch (err) {
      setStatus('Failed to send your message. Please try again later.')
    }
  }

  return (
    <div className="contact">
      <h2 className="page-title">Contact Us</h2>
      <div className="card contact-card">
        {status && <p className="contact-status">{status}</p>}
        <form onSubmit={onSubmit} className="stack contact-form">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone Number" />
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
          <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe your query" rows={5} />
          <button className="btn btn-primary" type="submit">Submit</button>
        </form>
      </div>
    </div>
  )
}
