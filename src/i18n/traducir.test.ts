import { describe, expect, it } from 'vitest'
import en from './en.json'
import pt from './pt.json'
import { prepararParaPrueba, traducir } from './traducir'

type Dic = Parameters<typeof prepararParaPrueba>[1]

describe('traducir', () => {
  it('traduce textos enteros respetando los espacios', () => {
    prepararParaPrueba('pt', pt as unknown as Dic)
    expect(traducir('Quiero jugar un amistoso')).toBe('Quero jogar um amistoso')
    expect(traducir('  Cancelar ')).toBe('  Cancelar ')
    expect(traducir(' Bienvenido ')).toBe(' Bem-vindo ')
  })
  it('usa las plantillas con nombres y números', () => {
    prepararParaPrueba('en', en as unknown as Dic)
    expect(traducir('Tu amigo Nico necesita 2 más')).toBe('Your friend Nico needs 2 more')
    expect(traducir('Nivel 7')).toBe('Level 7')
  })
  it('separa las frases armadas con " · "', () => {
    prepararParaPrueba('en', en as unknown as Dic)
    expect(traducir('Nivel 4 · Grupo de 2 · Argentina · hace 6 min')).toBe('Level 4 · Group of 2 · Argentina · 6 min ago')
  })
  it('deja como está lo que no conoce', () => {
    prepararParaPrueba('pt', pt as unknown as Dic)
    expect(traducir('buenas! alguien para un 3v3?')).toBe('buenas! alguien para un 3v3?')
    expect(traducir('42')).toBe('42')
  })
})
