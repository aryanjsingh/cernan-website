// Adapted from Spectrum UI's floating-navbar registry component.
import { ArrowUpRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import logo from '../../../branding/logo.png'

const links = [
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export default function Floatingnavbar() {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Cernan home">
        <img src={logo} alt="" width="42" height="42" />
        <span>CERNAN<span className="brand-period">.</span></span>
      </a>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.slice(0, 3).map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
      </nav>
      <a className="contact-link" href="#contact">Contact <ArrowUpRight size={15} strokeWidth={1.5} aria-hidden="true" /></a>
      <div className="mobile-nav">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="menu-trigger" aria-label="Open navigation menu"><Menu size={21} strokeWidth={1.5} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="nav-dropdown">
            {links.map(link => <DropdownMenuItem key={link.href} asChild><a href={link.href}>{link.label}<ArrowUpRight size={14} aria-hidden="true" /></a></DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
