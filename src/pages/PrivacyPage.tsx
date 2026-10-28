import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'

const CONTACT = import.meta.env.VITE_PRIVACY_CONTACT

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-lg font-bold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  )
}

/** Aviso de privacidade (informativo). Revise com quem for operar o app antes de divulgar. */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <a href="#/ajustes" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ajustes
      </a>
      <PageHeader title="Aviso de privacidade" subtitle="Como o MyLoja trata os dados da sua loja e dos seus clientes" />
      <Card className="flex flex-col gap-6 p-5">
        <Block title="Quem é responsável pelos dados">
          <p>
            Os dados de clientes (nome e telefone) e os lançamentos são da <strong>sua loja</strong>: você decide o que registrar e é quem responde por eles perante seus clientes. O MyLoja apenas guarda essas informações para você.
          </p>
        </Block>
        <Block title="O que é guardado">
          <p>Nome e telefone de clientes, vendas, prestações, compras, despesas, fechamentos de caixa, o nome e a logo da loja e, se você usar a nuvem, o seu e-mail de acesso.</p>
          <p>Registre apenas o necessário. Não coloque documentos (CPF, RG) nem dados sensíveis nas observações.</p>
        </Block>
        <Block title="Onde ficam">
          <p>Neste aparelho (armazenamento do navegador). Se você entrar com uma conta, uma cópia também é enviada ao Supabase, o serviço de banco de dados usado pelo app, e fica acessível somente pela sua conta.</p>
          <p>O PIN de bloqueio e a biometria ficam apenas neste aparelho e nunca são enviados à nuvem.</p>
        </Block>
        <Block title="Para que são usados">
          <p>Somente para o funcionamento do app: controle de vendas, fichas, relatórios e cópia de segurança. Os dados não são vendidos nem usados para propaganda.</p>
        </Block>
        <Block title="Seus direitos">
          <p>Você pode, a qualquer momento: ver e corrigir os dados no app; baixar uma cópia em <em>Ajustes → Cópia de segurança</em>; excluir lançamentos e clientes (ficam 30 dias na lixeira); e <strong>excluir sua conta e todos os dados</strong> da nuvem e deste aparelho em <em>Ajustes → Zona de perigo</em>.</p>
          <p>Clientes da loja podem pedir a correção ou a exclusão dos próprios dados diretamente a você.</p>
        </Block>
        <Block title="Segurança">
          <p>A conexão com a nuvem é criptografada e cada conta só enxerga os próprios dados. O bloqueio por PIN dificulta o acesso casual por outra pessoa ao aparelho, mas não substitui a senha do aparelho: mantenha-o protegido e faça cópias de segurança.</p>
        </Block>
        <Block title="Contato">
          <p>{CONTACT ? <>Dúvidas sobre privacidade: <a className="font-semibold text-brand-700 underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</> : 'Dúvidas sobre privacidade: fale com a pessoa que lhe entregou o app.'}</p>
        </Block>
        <p className="text-xs text-faint">Este texto é informativo e não substitui orientação jurídica (LGPD – Lei 13.709/2018).</p>
      </Card>
    </div>
  )
}
