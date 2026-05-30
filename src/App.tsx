import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import KofrinhoDetails from './pages/KofrinhoDetails'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kofrinho" element={<KofrinhoDetails />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
