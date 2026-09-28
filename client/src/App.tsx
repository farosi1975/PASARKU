import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PreviewGate from "./components/PreviewGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import OrderSummary from "./pages/OrderSummary";
import Admin from "./pages/Admin";
import Courier from "./pages/Courier";
import Login from "./pages/Login";
import Seller from "./pages/Seller";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/masuk" component={Login} /><Route path="/penjual" component={Seller} /><Route path="/produk/:id" component={ProductDetail} /><Route path="/pesanan/:id" component={OrderSummary} /><Route path="/admin" component={Admin} /><Route path="/kurir" component={Courier} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><PreviewGate><CartProvider><Router /></CartProvider></PreviewGate></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
