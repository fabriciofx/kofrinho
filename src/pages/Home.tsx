import KofrinhoForm from '../components/KofrinhoForm'
import '../styles/Home.css'

function Home() {
  return (
    <section id="home">
      <div>
        <h1>Kofrinho</h1>
        <p>Gerencie seus cofrinhos com facilidade</p>
      </div>
      <KofrinhoForm />
    </section>
  )
}

export default Home
