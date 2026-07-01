module.exports = {
  "/api/roles": {
    get: {
      tags: ["Roles"],
      summary: "Listar roles disponibles",
      description: "Devuelve los IDs numéricos de roles. Público (sin token).",
      operationId: "listRoles",
      responses: {
        200: {
          description: "Lista de roles",
          content: {
            "application/json": {
              example: {
                success: true,
                data: [
                  { id: 1, name: "Cliente" },
                  { id: 2, name: "Administrador" },
                ],
              },
            },
          },
        },
      },
    },
  },
};
