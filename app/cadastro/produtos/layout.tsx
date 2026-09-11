import ProdutosBalcaoEnhancer from '@/components/cadastro/ProdutosBalcaoEnhancer'

export default function ProdutosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ProdutosBalcaoEnhancer /></>
}
