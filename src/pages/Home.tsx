import KofrinhoForm from '../components/KofrinhoForm'
import Kofrinho from '../models/Kofrinho'
import '../styles/Home.css'

function Home() {
  const handleKofrinhoCreated = (kofrinho: Kofrinho) => {
    localStorage.setItem('kofrinho', JSON.stringify({
      usuario: kofrinho.usuario,
      nome: kofrinho.nome,
      dataCriacao: kofrinho.dataCriacao,
      saldo: kofrinho.valor()
    }))
  }

  return (
    <section id="home">
      <div>
        <h1>Kofrinho</h1>
        <p>Gerencie seus cofrinhos com facilidade</p>
      </div>
      <KofrinhoForm onKofrinhoCreated={handleKofrinhoCreated} />
    </section>
  )
}

export default Home
