import { EventReadinessSectionKey, EventStatus } from '../../../core/models/event.model';

export interface EventSectionMeta {
  key: EventReadinessSectionKey;
  title: string;
  description: string;
  icon: string;
  path: string;
  required: boolean;
}

/** Ordem recomendada de preenchimento (UC-37). */
export const EVENT_SECTIONS: EventSectionMeta[] = [
  {
    key: 'general',
    title: 'Informações gerais',
    description: 'Nome, data, local, capa, prazo de inscrição e contato',
    icon: 'info',
    path: 'geral',
    required: true,
  },
  {
    key: 'content',
    title: 'Conteúdo',
    description: 'Descrição, percurso, regulamento e seções personalizadas',
    icon: 'article',
    path: 'conteudo',
    required: true,
  },
  {
    key: 'categories',
    title: 'Categorias',
    description: 'Opções de inscrição por gênero, idade e desconto',
    icon: 'groups',
    path: 'categorias',
    required: true,
  },
  {
    key: 'proofs',
    title: 'Provas e lotes',
    description: 'Percursos, vagas e lotes de preço',
    icon: 'route',
    path: 'provas',
    required: true,
  },
  {
    key: 'kit',
    title: 'Kit do atleta',
    description: 'Itens do kit, tamanhos de camiseta e retirada',
    icon: 'checkroom',
    path: 'kit',
    required: false,
  },
  {
    key: 'questionnaire',
    title: 'Questionário',
    description: 'Perguntas extras na inscrição (nome no peito, assessoria…)',
    icon: 'quiz',
    path: 'questionario',
    required: false,
  },
  {
    key: 'settings',
    title: 'Configurações',
    description: 'Site e redes sociais do evento',
    icon: 'tune',
    path: 'configuracoes',
    required: false,
  },
];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Draft: 'Rascunho',
  Published: 'Publicado',
  Closed: 'Encerrado',
  Cancelled: 'Cancelado',
};
