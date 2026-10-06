import { useState } from 'react'
import type { Customer } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { DomainError } from '@/data/repository'
import { validateCustomerName } from '@/domain/validation'
import { navigate, paths } from '@/hooks/useRoute'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'

/** Cadastro mínimo: só o nome é obrigatório. Com `editing`, altera nome e telefone de um cliente existente. */
export function CustomerForm({ editing }: { editing?: Customer }) {
  const { customers, createCustomer, editCustomer } = useStore()
  const { closeSheet, toast } = useUI()
  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [error, setError] = useState<string>()

  const submit = () => {
    const err = validateCustomerName(name, editing ? customers.filter((c) => c.id !== editing.id) : customers)
    setError(err)
    if (err) return
    try {
      if (editing) {
        const c = editCustomer(editing.id, { name, phone })
        toast({ title: 'Cliente atualizado', description: c.name })
        closeSheet()
        return
      }
      const c = createCustomer({ name, phone })
      toast({ title: 'Cliente cadastrado', description: c.name })
      closeSheet()
      navigate(paths.customer(c.id))
    } catch (e) {
      setError(e instanceof DomainError ? e.message : 'Não foi possível cadastrar o cliente.')
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <TextField
        label="Nome"
        value={name}
        onChange={(v) => {
          setName(v)
          setError(undefined)
        }}
        error={error}
        placeholder="Ex.: Maria Souza"
        autoComplete="off"
        maxLength={80}
        data-autofocus=""
      />
      <TextField
        label="Telefone"
        optional
        value={phone}
        onChange={setPhone}
        type="tel"
        inputMode="tel"
        placeholder="(00) 00000-0000"
        autoComplete="off"
        maxLength={20}
      />
      <Button type="submit" size="lg" full>
        {editing ? 'Salvar alterações' : 'Cadastrar cliente'}
      </Button>
    </form>
  )
}
