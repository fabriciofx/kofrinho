import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { KofrinhoProvider } from './context/KofrinhoContext'
import Home from './pages/Home'
import KofrinhoDetails from './pages/KofrinhoDetails'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <KofrinhoProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kofrinho" element={<KofrinhoDetails />} />
        </Routes>
      </KofrinhoProvider>
    </BrowserRouter>
  )
}

export default App
