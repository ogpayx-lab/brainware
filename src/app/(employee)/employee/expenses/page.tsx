'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Expense } from '@/types/database'
import { useT } from '@/lib/i18n'

export default function ExpensesPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState('')

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('users').select('store_id, full_name').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)
    setEmployeeName(profile.full_name)

    const { data: shift } = await supabase
      .from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: exps } = await supabase
      .from('expenses')
      .select('*')
      .eq('shift_id', shift.id)
      .order('created_at', { ascending: false })

    setExpenses(exps ?? [])
    setTotal((exps ?? []).reduce((s, e) => s + e.amount, 0))
    setLoading(false)
  }

  async function handleAdd() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !description.trim() || !shiftId || !storeId || !userId) return
    setSaving(true)
    setError(null)

    let receiptPhotoUrl: string | null = null
    if (receiptFile && storeId) {
      const ext = receiptFile.name.split('.').pop() || 'jpg'
      const path = `expenses/${storeId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('photos').upload(path, receiptFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        receiptPhotoUrl = urlData?.publicUrl || null
      }
    }

    const { error: err } = await supabase.from('expenses').insert({
      shift_id: shiftId,
      store_id: storeId,
      user_id: userId,
      amount: amt,
      description: description.trim(),
      receipt_photo_url: receiptPhotoUrl,
    })

    if (err) { setError('Errore nel salvataggio.'); setSaving(false); return }

    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'expense',
      title: '💸 Spesa registrata',
      message: `${employeeName} ha registrato una spesa di €${amt.toFixed(2)}: ${description.trim()}`,
    })

    setAmount('')
    setDescription('')
    setReceiptFile(null)
    setReceiptPreview(null)
    await loadData()
    setSaving(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>{t('loading')}</div>

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
        <div style={{ flex: 1 }}>
          <h3>Gestione Spese</h3>
        </div>
        <span className="badge badge-success">Oggi</span>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Today total */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Spese di Oggi</div>
            <div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, color: total > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
              {fmt(total)}
            </div>
          </div>
          <span style={{ fontSize: 36 }}></span>
        </div>

        {/* Expense list */}
        {expenses.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {expenses.map((exp, i) => (
              <div key={exp.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: i < expenses.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{exp.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {formatTime(exp.created_at)}  {employeeName}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(exp as any).receipt_photo_url && (
                    <a href={(exp as any).receipt_photo_url} target="_blank" rel="noopener noreferrer" style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={(exp as any).receipt_photo_url} alt="Scontrino" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                    </a>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--danger)' }}>{fmt(exp.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
            Nessuna spesa registrata oggi
          </div>
        )}

        {/* Add expense form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h4>Nuova Spesa</h4>

          <div className="input-group">
            <label className="input-label">Importo ()</label>
            <div className="input-with-prefix">
              <span className="input-prefix"></span>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Descrizione</label>
            <input
              className="input"
              type="text"
              placeholder="Descrivi la spesa..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">📷 Foto Scontrino (opzionale)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                📷 {receiptFile ? 'Cambia foto' : 'Scatta / Scegli'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setReceiptFile(file)
                      setReceiptPreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </label>
              {receiptPreview && (
                <div style={{ position: 'relative' }}>
                  <img src={receiptPreview} alt="Preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', fontSize: 13, color: 'var(--text-tertiary)' }}>
            <span>Referente: {employeeName}</span>
            <span></span>
            <span>Data: {new Date().toLocaleDateString('it-IT')}</span>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px var(--space-md)', fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={saving || !amount || !description.trim()}
            className="btn btn-primary btn-full"
          >
            {saving ? t('saving') : 'Registra Spesa'}
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
